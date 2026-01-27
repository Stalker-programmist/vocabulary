from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException
from sqlalchemy import func
from sqlmodel import Session, select

from ..db import engine
from ..models import Review, Word
from ..schemas import ReviewResult, StatsOut, WordCreate, WordUpdate
from ..services.review import MAX_STAGE, next_review_date
from ..services.tags import normalize_tag, normalize_tags

router = APIRouter(prefix="/api")


@router.get("/words", response_model=list[Word])
def list_words(
    q: Optional[str] = None,
    tag: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Word]:
    statement = select(Word)
    if q:
        query = q.strip().lower()
        like = f"%{query}%"
        statement = statement.where(
            func.lower(Word.term).like(like)
            | func.lower(Word.translation).like(like)
        )
    normalized_tag = normalize_tag(tag)
    if normalized_tag:
        statement = statement.where(
            (Word.tags == normalized_tag)
            | (Word.tags.like(f"{normalized_tag},%"))
            | (Word.tags.like(f"%,{normalized_tag},%"))
            | (Word.tags.like(f"%,{normalized_tag}"))
        )
    statement = statement.order_by(Word.created_at.desc()).limit(limit).offset(offset)
    with Session(engine) as session:
        return session.exec(statement).all()


@router.post("/words", response_model=Word, status_code=201)
def create_word(payload: WordCreate) -> Word:
    today = date.today()
    word = Word(
        term=payload.term.strip(),
        translation=payload.translation.strip(),
        example=payload.example.strip() if payload.example else None,
        tags=normalize_tags(payload.tags),
        stage=0,
        next_review=today,
    )
    with Session(engine) as session:
        session.add(word)
        session.commit()
        session.refresh(word)
        return word


@router.patch("/words/{word_id}", response_model=Word)
def update_word(word_id: int, payload: WordUpdate) -> Word:
    with Session(engine) as session:
        word = session.get(Word, word_id)
        if not word:
            raise HTTPException(status_code=404, detail="Word not found")
        if payload.term is not None:
            word.term = payload.term.strip()
        if payload.translation is not None:
            word.translation = payload.translation.strip()
        if payload.example is not None:
            word.example = payload.example.strip() or None
        if payload.tags is not None:
            word.tags = normalize_tags(payload.tags)
        session.add(word)
        session.commit()
        session.refresh(word)
        return word


@router.delete("/words/{word_id}")
def delete_word(word_id: int) -> dict:
    with Session(engine) as session:
        word = session.get(Word, word_id)
        if not word:
            raise HTTPException(status_code=404, detail="Word not found")
        session.delete(word)
        session.commit()
    return {"ok": True}


@router.get("/review/today", response_model=list[Word])
def review_today(limit: int = 20) -> list[Word]:
    today = date.today()
    statement = (
        select(Word)
        .where(Word.next_review <= today)
        .order_by(Word.next_review, Word.stage)
        .limit(limit)
    )
    with Session(engine) as session:
        return session.exec(statement).all()


@router.post("/review/{word_id}", response_model=Word)
def review_word(word_id: int, payload: ReviewResult) -> Word:
    result = payload.result.strip().lower()
    if result not in {"good", "bad"}:
        raise HTTPException(status_code=400, detail="Result must be good or bad")
    today = date.today()
    with Session(engine) as session:
        word = session.get(Word, word_id)
        if not word:
            raise HTTPException(status_code=404, detail="Word not found")
        if result == "good":
            word.stage = min(word.stage + 1, MAX_STAGE)
            word.next_review = next_review_date(word.stage, today)
            result_bool = True
        else:
            word.stage = 0
            word.next_review = today + timedelta(days=1)
            result_bool = False
        review = Review(
            word_id=word.id,
            result=result_bool,
            next_review_assigned=word.next_review,
        )
        session.add(review)
        session.add(word)
        session.commit()
        session.refresh(word)
        return word


@router.get("/stats", response_model=StatsOut)
def get_stats() -> StatsOut:
    today = date.today()
    start_today = datetime.combine(today, datetime.min.time())
    start_7d = datetime.now() - timedelta(days=7)
    next_7d = today + timedelta(days=7)
    with Session(engine) as session:
        today_due_count = session.exec(
            select(func.count()).select_from(Word).where(Word.next_review <= today)
        ).one()
        reviewed_today_count = session.exec(
            select(func.count())
            .select_from(Review)
            .where(Review.reviewed_at >= start_today)
        ).one()
        new_words_7d = session.exec(
            select(func.count())
            .select_from(Word)
            .where(Word.created_at >= start_7d)
        ).one()
        due_next_7d = session.exec(
            select(func.count())
            .select_from(Word)
            .where(Word.next_review > today, Word.next_review <= next_7d)
        ).one()
    return StatsOut(
        today_due_count=today_due_count,
        reviewed_today_count=reviewed_today_count,
        new_words_7d=new_words_7d,
        due_next_7d=due_next_7d,
    )


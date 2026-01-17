from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func
from sqlmodel import Field, SQLModel, Session, create_engine, select

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

DATABASE_URL = "sqlite:///./vocabulary.db"
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}, echo=False
)

STAGE_INTERVALS = [1, 3, 7, 14, 30]
MAX_STAGE = len(STAGE_INTERVALS) - 1


class Word(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    term: str
    translation: str
    example: Optional[str] = None
    tags: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    stage: int = Field(default=0)
    next_review: date = Field(default_factory=date.today)


class Review(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    word_id: int = Field(foreign_key="word.id")
    reviewed_at: datetime = Field(default_factory=datetime.now)
    result: bool
    next_review_assigned: date


class WordCreate(SQLModel):
    term: str
    translation: str
    example: Optional[str] = None
    tags: Optional[str] = None


class WordUpdate(SQLModel):
    term: Optional[str] = None
    translation: Optional[str] = None
    example: Optional[str] = None
    tags: Optional[str] = None


class ReviewResult(SQLModel):
    result: str


class StatsOut(SQLModel):
    today_due_count: int
    reviewed_today_count: int
    new_words_7d: int
    due_next_7d: int


@asynccontextmanager
async def lifespan(_: FastAPI):
    SQLModel.metadata.create_all(engine)
    yield


app = FastAPI(title="Vocabulary Trainer", version="0.1.0", lifespan=lifespan)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


def normalize_tags(tags: Optional[str]) -> Optional[str]:
    if tags is None:
        return None
    parts = [part.strip().lower() for part in tags.split(",") if part.strip()]
    if not parts:
        return None
    return ",".join(parts)


def normalize_tag(tag: Optional[str]) -> Optional[str]:
    if not tag:
        return None
    parts = [part.strip().lower() for part in tag.split(",") if part.strip()]
    if not parts:
        return None
    return parts[0]


def next_review_date(stage: int, today: date) -> date:
    interval = STAGE_INTERVALS[stage]
    return today + timedelta(days=interval)


@app.get("/", include_in_schema=False)
def read_index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/words", response_model=list[Word])
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


@app.post("/api/words", response_model=Word, status_code=201)
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


@app.patch("/api/words/{word_id}", response_model=Word)
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


@app.delete("/api/words/{word_id}")
def delete_word(word_id: int) -> dict:
    with Session(engine) as session:
        word = session.get(Word, word_id)
        if not word:
            raise HTTPException(status_code=404, detail="Word not found")
        session.delete(word)
        session.commit()
    return {"ok": True}


@app.get("/api/review/today", response_model=list[Word])
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


@app.post("/api/review/{word_id}", response_model=Word)
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


@app.get("/api/stats", response_model=StatsOut)
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

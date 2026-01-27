from __future__ import annotations

import csv
import io
from datetime import date, datetime, timedelta
from typing import Optional

import secrets
from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import func
from sqlmodel import Session, select

from ..db import engine
from ..models import Review, User, VerificationCode, Word
from ..schemas import (
    AuthLogin,
    AuthRegister,
    AuthToken,
    AuthVerify,
    ReviewResult,
    StatsOut,
    UserOut,
    WordCreate,
    WordUpdate,
)
from ..services.auth import create_access_token, decode_access_token, hash_password, verify_password
from ..services.review import MAX_STAGE, next_review_date
from ..services.tags import normalize_tag, normalize_tags
from ..services.email import send_verification_email

router = APIRouter(prefix="/api")


def parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def parse_stage(value: Optional[str]) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except ValueError:
        return None


def merge_translation(existing: str, incoming: str) -> str:
    existing = existing.strip()
    incoming = incoming.strip()
    if not existing:
        return ", ".join(
            [part for part in (p.strip() for p in incoming.split(",")) if part]
        )
    if not incoming:
        return existing
    parts = [part.strip() for part in existing.split(",") if part.strip()]
    lower_parts = {part.lower() for part in parts}
    for part in incoming.split(","):
        cleaned = part.strip()
        if not cleaned:
            continue
        if cleaned.lower() in lower_parts:
            continue
        parts.append(cleaned)
        lower_parts.add(cleaned.lower())
    return ", ".join(parts)


def merge_tags(existing: Optional[str], incoming: Optional[str]) -> Optional[str]:
    normalized_existing = normalize_tags(existing)
    normalized_incoming = normalize_tags(incoming)
    if not normalized_existing:
        return normalized_incoming
    if not normalized_incoming:
        return normalized_existing
    parts = [part.strip() for part in normalized_existing.split(",") if part.strip()]
    lower_parts = {part.lower() for part in parts}
    for tag in normalized_incoming.split(","):
        tag = tag.strip()
        if not tag:
            continue
        if tag.lower() in lower_parts:
            continue
        parts.append(tag)
        lower_parts.add(tag.lower())
    return ",".join(parts)


def build_time_buckets(
    start: datetime, end: datetime, step: timedelta, fmt: str
) -> list[str]:
    buckets = []
    cursor = start
    while cursor <= end:
        buckets.append(cursor.strftime(fmt))
        cursor += step
    return buckets

def get_current_user(authorization: Optional[str] = Header(None)) -> User:
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    subject = decode_access_token(token)
    if not subject:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    with Session(engine) as session:
        user = session.exec(
            select(User).where(func.lower(User.email) == subject.lower())
        ).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if not user.is_verified:
            raise HTTPException(status_code=403, detail="Email not verified")
        return user

@router.post("/auth/register")
def register(payload: AuthRegister) -> dict:
    email = payload.email.strip().lower()
    password = payload.password.strip()
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")
    with Session(engine) as session:
        existing = session.exec(
            select(User).where(func.lower(User.email) == email)
        ).first()
        if existing and existing.is_verified:
            raise HTTPException(status_code=409, detail="Email already registered")
        if existing:
            existing.password_hash = hash_password(password)
            user = existing
        else:
            user = User(email=email, password_hash=hash_password(password))
            session.add(user)
            session.commit()
            session.refresh(user)

        code = f"{secrets.randbelow(1000000):06d}"
        verification = VerificationCode(
            user_id=user.id,
            code=code,
            expires_at=datetime.now() + timedelta(minutes=10),
        )
        session.add(verification)
        session.commit()

    try:
        send_verification_email(email, code)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {"ok": True}


@router.post("/auth/verify")
def verify_email(payload: AuthVerify) -> dict:
    email = payload.email.strip().lower()
    code = payload.code.strip()
    if not email or not code:
        raise HTTPException(status_code=400, detail="Email and code required")
    with Session(engine) as session:
        user = session.exec(
            select(User).where(func.lower(User.email) == email)
        ).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        latest = session.exec(
            select(VerificationCode)
            .where(VerificationCode.user_id == user.id)
            .order_by(VerificationCode.created_at.desc())
        ).first()
        if not latest or latest.code != code:
            raise HTTPException(status_code=400, detail="Invalid code")
        if latest.expires_at < datetime.now():
            raise HTTPException(status_code=400, detail="Code expired")
        user.is_verified = True
        session.add(user)
        session.commit()
    return {"ok": True}


@router.post("/auth/login", response_model=AuthToken)
def login(payload: AuthLogin) -> AuthToken:
    email = payload.email.strip().lower()
    password = payload.password.strip()
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")
    with Session(engine) as session:
        user = session.exec(
            select(User).where(func.lower(User.email) == email)
        ).first()
        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not user.is_verified:
            raise HTTPException(status_code=403, detail="Email not verified")
        claim_legacy_data(session, user.id)
        session.commit()
    token = create_access_token(email)
    return AuthToken(access_token=token)


@router.get("/auth/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> UserOut:
    return UserOut(id=current_user.id, email=current_user.email, is_verified=True)


def claim_legacy_data(session: Session, user_id: int) -> None:
    session.execute(
        Word.__table__.update()
        .where(Word.user_id.is_(None))
        .values(user_id=user_id)
    )
    session.execute(
        Review.__table__.update()
        .where(Review.user_id.is_(None))
        .values(user_id=user_id)
    )


@router.get("/words", response_model=list[Word])
def list_words(
    current_user: User = Depends(get_current_user),
    q: Optional[str] = None,
    tag: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Word]:
    statement = select(Word).where(Word.user_id == current_user.id)
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
def create_word(payload: WordCreate, current_user: User = Depends(get_current_user)) -> Word:
    today = date.today()
    with Session(engine) as session:
        normalized_term = payload.term.strip()
        existing = session.exec(
            select(Word).where(
                Word.user_id == current_user.id,
                func.lower(Word.term) == normalized_term.lower(),
            )
        ).first()
        if existing:
            merged_translation = merge_translation(
                existing.translation, payload.translation.strip()
            )
            merged_tags = merge_tags(existing.tags, payload.tags)
            if (
                merged_translation == existing.translation
                and merged_tags == existing.tags
            ):
                return existing
            existing.translation = merged_translation
            existing.tags = merged_tags
            session.add(existing)
            session.commit()
            session.refresh(existing)
            return existing

        word = Word(
            term=normalized_term,
            translation=payload.translation.strip(),
            example=payload.example.strip() if payload.example else None,
            tags=normalize_tags(payload.tags),
            stage=0,
            next_review=today,
            user_id=current_user.id,
        )
        session.add(word)
        session.commit()
        session.refresh(word)
        return word


@router.patch("/words/{word_id}", response_model=Word)
def update_word(
    word_id: int, payload: WordUpdate, current_user: User = Depends(get_current_user)
) -> Word:
    with Session(engine) as session:
        word = session.get(Word, word_id)
        if not word or word.user_id != current_user.id:
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
def delete_word(word_id: int, current_user: User = Depends(get_current_user)) -> dict:
    with Session(engine) as session:
        word = session.get(Word, word_id)
        if not word or word.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Word not found")
        session.delete(word)
        session.commit()
    return {"ok": True}


@router.get("/review/today", response_model=list[Word])
def review_today(
    limit: int = 20, current_user: User = Depends(get_current_user)
) -> list[Word]:
    today = date.today()
    statement = (
        select(Word)
        .where(Word.user_id == current_user.id, Word.next_review <= today)
        .order_by(Word.next_review, Word.stage)
        .limit(limit)
    )
    with Session(engine) as session:
        return session.exec(statement).all()


@router.post("/review/{word_id}", response_model=Word)
def review_word(
    word_id: int, payload: ReviewResult, current_user: User = Depends(get_current_user)
) -> Word:
    result = payload.result.strip().lower()
    if result not in {"good", "bad"}:
        raise HTTPException(status_code=400, detail="Result must be good or bad")
    today = date.today()
    with Session(engine) as session:
        word = session.get(Word, word_id)
        if not word or word.user_id != current_user.id:
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
            user_id=current_user.id,
        )
        session.add(review)
        session.add(word)
        session.commit()
        session.refresh(word)
        return word


@router.get("/stats", response_model=StatsOut)
def get_stats(current_user: User = Depends(get_current_user)) -> StatsOut:
    today = date.today()
    start_today = datetime.combine(today, datetime.min.time())
    now = datetime.now()
    start_1d = now - timedelta(days=1)
    start_7d = now - timedelta(days=7)
    start_30d = now - timedelta(days=30)
    start_365d = now - timedelta(days=365)
    next_7d = today + timedelta(days=7)
    with Session(engine) as session:
        today_due_count = session.exec(
            select(func.count())
            .select_from(Word)
            .where(Word.user_id == current_user.id, Word.next_review <= today)
        ).one()
        reviewed_today_count = session.exec(
            select(func.count())
            .select_from(Review)
            .where(
                Review.user_id == current_user.id,
                Review.reviewed_at >= start_today,
            )
        ).one()
        new_words_1d = session.exec(
            select(func.count())
            .select_from(Word)
            .where(Word.user_id == current_user.id, Word.created_at >= start_1d)
        ).one()
        new_words_7d = session.exec(
            select(func.count())
            .select_from(Word)
            .where(Word.user_id == current_user.id, Word.created_at >= start_7d)
        ).one()
        new_words_30d = session.exec(
            select(func.count())
            .select_from(Word)
            .where(Word.user_id == current_user.id, Word.created_at >= start_30d)
        ).one()
        new_words_365d = session.exec(
            select(func.count())
            .select_from(Word)
            .where(Word.user_id == current_user.id, Word.created_at >= start_365d)
        ).one()
        reviews_1d = session.exec(
            select(func.count())
            .select_from(Review)
            .where(
                Review.user_id == current_user.id,
                Review.reviewed_at >= start_1d,
            )
        ).one()
        reviews_7d = session.exec(
            select(func.count())
            .select_from(Review)
            .where(
                Review.user_id == current_user.id,
                Review.reviewed_at >= start_7d,
            )
        ).one()
        reviews_30d = session.exec(
            select(func.count())
            .select_from(Review)
            .where(
                Review.user_id == current_user.id,
                Review.reviewed_at >= start_30d,
            )
        ).one()
        reviews_365d = session.exec(
            select(func.count())
            .select_from(Review)
            .where(
                Review.user_id == current_user.id,
                Review.reviewed_at >= start_365d,
            )
        ).one()
        due_next_7d = session.exec(
            select(func.count())
            .select_from(Word)
            .where(
                Word.user_id == current_user.id,
                Word.next_review > today,
                Word.next_review <= next_7d,
            )
        ).one()
    return StatsOut(
        today_due_count=today_due_count,
        reviewed_today_count=reviewed_today_count,
        new_words_1d=new_words_1d,
        new_words_7d=new_words_7d,
        new_words_30d=new_words_30d,
        new_words_365d=new_words_365d,
        reviews_1d=reviews_1d,
        reviews_7d=reviews_7d,
        reviews_30d=reviews_30d,
        reviews_365d=reviews_365d,
        due_next_7d=due_next_7d,
    )


@router.get("/stats/series")
def get_stats_series(
    range: str = "7d", current_user: User = Depends(get_current_user)
) -> dict:
    now = datetime.now()
    range = range.lower()
    if range not in {"1d", "7d", "30d", "365d"}:
        raise HTTPException(status_code=400, detail="range must be 1d, 7d, 30d, or 365d")

    if range == "1d":
        start = now - timedelta(hours=23)
        step = timedelta(hours=1)
        fmt = "%Y-%m-%d %H:00"
        label_fmt = "%H:00"
        group_expr_reviews = func.strftime("%Y-%m-%d %H:00", Review.reviewed_at, "localtime")
        group_expr_words = func.strftime("%Y-%m-%d %H:00", Word.created_at, "localtime")
    else:
        days = {"7d": 6, "30d": 29, "365d": 364}[range]
        start_date = (now.date() - timedelta(days=days))
        start = datetime.combine(start_date, datetime.min.time())
        step = timedelta(days=1)
        fmt = "%Y-%m-%d"
        label_fmt = "%b %d"
        group_expr_reviews = func.strftime("%Y-%m-%d", Review.reviewed_at, "localtime")
        group_expr_words = func.strftime("%Y-%m-%d", Word.created_at, "localtime")

    buckets = build_time_buckets(start, now, step, fmt)
    labels = [
        datetime.strptime(key, fmt).strftime(label_fmt) for key in buckets
    ]

    with Session(engine) as session:
        review_rows = session.exec(
            select(group_expr_reviews, func.count())
            .where(
                Review.user_id == current_user.id,
                Review.reviewed_at >= start,
            )
            .group_by(group_expr_reviews)
        ).all()
        word_rows = session.exec(
            select(group_expr_words, func.count())
            .where(
                Word.user_id == current_user.id,
                Word.created_at >= start,
            )
            .group_by(group_expr_words)
        ).all()

    review_map = {row[0]: row[1] for row in review_rows if row[0]}
    word_map = {row[0]: row[1] for row in word_rows if row[0]}
    reviews = [review_map.get(key, 0) for key in buckets]
    new_words = [word_map.get(key, 0) for key in buckets]

    return {
        "range": range,
        "labels": labels,
        "keys": buckets,
        "new_words": new_words,
        "reviews": reviews,
    }


@router.get("/words/export")
def export_words(current_user: User = Depends(get_current_user)) -> Response:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        ["term", "translation", "example", "tags", "stage", "next_review", "created_at"]
    )
    with Session(engine) as session:
        words = session.exec(
            select(Word)
            .where(Word.user_id == current_user.id)
            .order_by(Word.created_at.desc())
        ).all()
        for word in words:
            writer.writerow(
                [
                    word.term,
                    word.translation,
                    word.example or "",
                    word.tags or "",
                    word.stage,
                    word.next_review.isoformat() if word.next_review else "",
                    word.created_at.isoformat(timespec="seconds"),
                ]
            )
    response = Response(content=output.getvalue(), media_type="text/csv; charset=utf-8")
    response.headers["Content-Disposition"] = "attachment; filename=vocabulary_words.csv"
    return response


@router.post("/words/import")
async def import_words(
    file: UploadFile = File(...), current_user: User = Depends(get_current_user)
) -> dict:
    if not file:
        raise HTTPException(status_code=400, detail="CSV file is required")
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="CSV file is empty")
    try:
        text = contents.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400, detail="CSV must be UTF-8 encoded"
        ) from exc

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV must include headers")

    imported = 0
    skipped = 0
    today = date.today()
    now = datetime.now()

    with Session(engine) as session:
        for row in reader:
            normalized = {}
            for key, value in row.items():
                if key is None:
                    continue
                normalized[str(key).strip().lower()] = "" if value is None else str(value)
            term = normalized.get("term", "").strip()
            translation = normalized.get("translation", "").strip()
            if not term or not translation:
                skipped += 1
                continue

            example_raw = normalized.get("example", "").strip()
            tags_raw = normalized.get("tags", "").strip()
            stage_raw = parse_stage(normalized.get("stage"))
            next_review = parse_date(normalized.get("next_review"))
            created_at = parse_datetime(normalized.get("created_at"))

            stage = min(max(stage_raw or 0, 0), MAX_STAGE)
            if not next_review:
                if stage == 0:
                    next_review = today
                else:
                    next_review = next_review_date(stage, today)

            existing = session.exec(
                select(Word).where(
                    Word.user_id == current_user.id,
                    func.lower(Word.term) == term.lower(),
                )
            ).first()
            if existing:
                merged_translation = merge_translation(existing.translation, translation)
                merged_tags = merge_tags(existing.tags, tags_raw)
                if (
                    merged_translation == existing.translation
                    and merged_tags == existing.tags
                ):
                    skipped += 1
                    continue
                existing.translation = merged_translation
                existing.tags = merged_tags
                session.add(existing)
                imported += 1
                continue

            word = Word(
                term=term,
                translation=translation,
                example=example_raw or None,
                tags=normalize_tags(tags_raw),
                stage=stage,
                next_review=next_review,
                created_at=created_at or now,
                user_id=current_user.id,
            )
            session.add(word)
            imported += 1
        session.commit()

    return {"imported": imported, "skipped": skipped, "total": imported + skipped}


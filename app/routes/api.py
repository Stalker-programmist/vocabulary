from __future__ import annotations

import csv
import io
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy import and_, case, desc, func
from sqlmodel import Session, select

from ..db import engine
from ..deps import get_current_user, get_session
from ..models import Review, User, Word
from ..schemas import (
    EnsureExamplesIn,
    LeaderboardEntryOut,
    ProfileOut,
    ReviewResult,
    StatsOut,
    StatsSeriesOut,
    ThemeOut,
    WordCreate,
    WordUpdate,
)
from ..services.examples import generate_example_sentence
from ..services.review import MAX_STAGE, next_review_date
from ..services.tags import normalize_tag, normalize_tags

router = APIRouter(prefix="/api", tags=["api"])


def _generate_example_for_word(word_id: int, user_id: int) -> None:
    """
    Фоновая задача: генерируем example, если он пустой.
    Важно: используем отдельную сессию БД, чтобы не зависеть от контекста запроса.
    """
    try:
        with Session(engine) as background_session:
            word = background_session.get(Word, word_id)
            if not word or word.user_id != user_id:
                return
            if word.example:
                return
            word.example = generate_example_sentence(word.term, word.translation)
            background_session.add(word)
            background_session.commit()
    except Exception:
        # Ошибки генерации не должны ломать основной поток.
        return


@router.get("/themes", response_model=list[ThemeOut])
def list_themes(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[ThemeOut]:
    # Темы = теги слов пользователя (CSV в поле `tags`).
    words = session.exec(select(Word.tags).where(Word.user_id == user.id)).all()
    counts: dict[str, int] = {}
    for tags in words:
        if not tags:
            continue
        for raw in str(tags).split(","):
            tag = raw.strip().lower()
            if not tag:
                continue
            counts[tag] = counts.get(tag, 0) + 1

    themes = [ThemeOut(tag=tag, count=count) for tag, count in counts.items()]
    themes.sort(key=lambda item: (-item.count, item.tag))
    return themes


@router.get("/words", response_model=list[Word])
def list_words(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    q: Optional[str] = None,
    tag: Optional[str] = None,
    starred: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Word]:
    statement = select(Word).where(Word.user_id == user.id)
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
    if starred is True:
        statement = statement.where(Word.starred.is_(True))
    elif starred is False:
        statement = statement.where(Word.starred.is_(False))
    statement = statement.order_by(Word.created_at.desc()).limit(limit).offset(offset)
    return session.exec(statement).all()


@router.post("/words", response_model=Word, status_code=201)
def create_word(
    payload: WordCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Word:
    today = date.today()
    word = Word(
        user_id=user.id,
        term=payload.term.strip(),
        translation=payload.translation.strip(),
        example=payload.example.strip() if payload.example else None,
        tags=normalize_tags(payload.tags),
        starred=bool(payload.starred),
        stage=0,
        next_review=today,
    )
    session.add(word)
    session.commit()
    session.refresh(word)
    if not word.example:
        # Генерируем пример лениво — в фоне, чтобы форма "Add word" не тормозила.
        background_tasks.add_task(_generate_example_for_word, word.id, user.id)
    return word


@router.patch("/words/{word_id}", response_model=Word)
def update_word(
    word_id: int,
    payload: WordUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Word:
    word = session.get(Word, word_id)
    if not word or word.user_id != user.id:
        raise HTTPException(status_code=404, detail="Word not found")
    if payload.term is not None:
        word.term = payload.term.strip()
    if payload.translation is not None:
        word.translation = payload.translation.strip()
    if payload.example is not None:
        word.example = payload.example.strip() or None
    if payload.tags is not None:
        word.tags = normalize_tags(payload.tags)
    if payload.starred is not None:
        word.starred = bool(payload.starred)
    session.add(word)
    session.commit()
    session.refresh(word)
    return word


@router.get("/profile", response_model=ProfileOut)
def profile_summary(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ProfileOut:
    today = date.today()
    total_words = session.exec(
        select(func.count()).select_from(Word).where(Word.user_id == user.id)
    ).one()
    starred_words = session.exec(
        select(func.count())
        .select_from(Word)
        .where(Word.user_id == user.id, Word.starred.is_(True))
    ).one()
    due_today = session.exec(
        select(func.count())
        .select_from(Word)
        .where(Word.user_id == user.id, Word.next_review <= today)
    ).one()
    return ProfileOut(
        total_words=total_words,
        starred_words=starred_words,
        due_today=due_today,
    )


@router.delete("/words/{word_id}")
def delete_word(
    word_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    word = session.get(Word, word_id)
    if not word or word.user_id != user.id:
        raise HTTPException(status_code=404, detail="Word not found")
    session.delete(word)
    session.commit()
    return {"ok": True}


@router.post("/words/examples", response_model=list[Word])
def ensure_word_examples(
    payload: EnsureExamplesIn,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[Word]:
    """
    Ленивая генерация примеров: дополняем `example` у слов пользователя.
    Используется, чтобы тренировки работали, даже если примеры не введены вручную.
    """
    ids = list({int(x) for x in (payload.word_ids or []) if int(x) > 0})
    if not ids:
        return []

    statement = select(Word).where(Word.user_id == user.id, Word.id.in_(ids))
    words = session.exec(statement).all()

    changed = False
    for word in words:
        if word.example and not payload.force:
            continue
        word.example = generate_example_sentence(word.term, word.translation)
        session.add(word)
        changed = True

    if changed:
        session.commit()
        for word in words:
            session.refresh(word)

    return words


@router.post("/words/import")
async def import_words_csv(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    """
    Импорт слов из CSV.
    Поддерживаемые колонки: term, translation, example, tags (остальные игнорируются).
    """
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded")

    reader = csv.DictReader(io.StringIO(text))
    today = date.today()

    imported = 0
    skipped = 0
    for row in reader:
        term = (row.get("term") or "").strip()
        translation = (row.get("translation") or "").strip()
        if not term or not translation:
            skipped += 1
            continue
        example = (row.get("example") or "").strip() or None
        tags = normalize_tags(row.get("tags"))

        word = Word(
            user_id=user.id,
            term=term,
            translation=translation,
            example=example,
            tags=tags,
            stage=0,
            next_review=today,
        )
        session.add(word)
        imported += 1

    session.commit()
    return {"imported": imported, "skipped": skipped}


@router.get("/words/export")
def export_words_csv(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    words = session.exec(
        select(Word)
        .where(Word.user_id == user.id)
        .order_by(Word.created_at.desc())
    ).all()

    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["term", "translation", "example", "tags", "stage", "next_review", "created_at"])
    for w in words:
        writer.writerow(
            [
                w.term,
                w.translation,
                w.example or "",
                w.tags or "",
                w.stage,
                w.next_review.isoformat() if w.next_review else "",
                w.created_at.isoformat() if w.created_at else "",
            ]
        )

    content = out.getvalue()
    headers = {
        "Content-Disposition": 'attachment; filename="vocabulary_words.csv"'
    }
    return Response(content, media_type="text/csv; charset=utf-8", headers=headers)



@router.get("/review/today", response_model=list[Word])
def review_today(
    limit: int = 50,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[Word]:
    today = date.today()
    # TODO: сделать limit на кол-во запросов. Для <= 50 - 3 в секунуду. Для > 50 - 1 в секунду
    statement = (
        select(Word) # Выбрать слово, где id равен указанному и слово актуальное, остортировать по актуальности (первый приоритет) и по стадии (второй приоритет),
        .where(Word.user_id == user.id, Word.next_review <= today)
        .order_by(Word.next_review, Word.stage)
        .limit(limit)
    )
    return session.exec(statement).all()


@router.post("/review/{word_id}", response_model=Word)
def review_word(
    word_id: int,
    payload: ReviewResult,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Word:
    result = payload.result.strip().lower()
    if result not in {"good", "bad"}:
        raise HTTPException(status_code=400, detail="Result must be good or bad")
    today = date.today()
    word = session.get(Word, word_id)
    if not word or word.user_id != user.id:
        raise HTTPException(status_code=404, detail="Word not found")

    if result == "good":
        word.stage = min(word.stage + 1, MAX_STAGE)
        if word.stage == MAX_STAGE:
            # Считаем слово «выученным» в момент достижения максимального stage.
            word.mastered_at = datetime.now()
        word.next_review = next_review_date(word.stage, today)
        result_bool = True
    else:
        word.stage = 0
        word.next_review = today + timedelta(days=1)
        result_bool = False

    review = Review(
        word_id=word.id,
        user_id=user.id,
        result=result_bool,
        next_review_assigned=word.next_review,
    )
    session.add(review)
    session.add(word)
    session.commit()
    session.refresh(word)
    return word


@router.get("/stats", response_model=StatsOut)
def get_stats(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> StatsOut:
    today = date.today()
    start_today = datetime.combine(today, datetime.min.time())

    now = datetime.now()
    start_1d = now - timedelta(days=1)
    start_7d = now - timedelta(days=7)
    start_30d = now - timedelta(days=30)
    start_365d = now - timedelta(days=365)

    next_7d = today + timedelta(days=7)

    today_due_count = session.exec(
        select(func.count())
        .select_from(Word)
        .where(Word.user_id == user.id, Word.next_review <= today)
    ).one()

    reviewed_today_count = session.exec(
        select(func.count())
        .select_from(Review)
        .where(Review.user_id == user.id, Review.reviewed_at >= start_today)
    ).one()

    new_words_1d = session.exec(
        select(func.count())
        .select_from(Word)
        .where(Word.user_id == user.id, Word.created_at >= start_1d)
    ).one()
    new_words_7d = session.exec(
        select(func.count())
        .select_from(Word)
        .where(Word.user_id == user.id, Word.created_at >= start_7d)
    ).one()
    new_words_30d = session.exec(
        select(func.count())
        .select_from(Word)
        .where(Word.user_id == user.id, Word.created_at >= start_30d)
    ).one()
    new_words_365d = session.exec(
        select(func.count())
        .select_from(Word)
        .where(Word.user_id == user.id, Word.created_at >= start_365d)
    ).one()

    reviews_1d = session.exec(
        select(func.count())
        .select_from(Review)
        .where(Review.user_id == user.id, Review.reviewed_at >= start_1d)
    ).one()
    reviews_7d = session.exec(
        select(func.count())
        .select_from(Review)
        .where(Review.user_id == user.id, Review.reviewed_at >= start_7d)
    ).one()
    reviews_30d = session.exec(
        select(func.count())
        .select_from(Review)
        .where(Review.user_id == user.id, Review.reviewed_at >= start_30d)
    ).one()
    reviews_365d = session.exec(
        select(func.count())
        .select_from(Review)
        .where(Review.user_id == user.id, Review.reviewed_at >= start_365d)
    ).one()

    due_next_7d = session.exec(
        select(func.count())
        .select_from(Word)
        .where(
            Word.user_id == user.id,
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


@router.get("/stats/series", response_model=StatsSeriesOut)
def stats_series(
    range_key: str = Query(default="7d", alias="range"),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> StatsSeriesOut:
    """
    Серии для Activity chart: новые слова vs повторы.
    Диапазоны: 1d, 7d, 30d, 365d.
    """
    now = datetime.now()
    allowed = {"1d", "7d", "30d", "365d"}
    if range_key not in allowed:
        range_key = "7d"

    if range_key == "1d":
        # Последние 24 часа по часам.
        end = now.replace(minute=0, second=0, microsecond=0)
        start = end - timedelta(hours=23)
        buckets = [start + timedelta(hours=i) for i in range(24)]
        labels = [dt.strftime("%H:%M") for dt in buckets]

        words_rows = session.exec(
            select(Word.created_at)
            .where(Word.user_id == user.id, Word.created_at >= start, Word.created_at <= end + timedelta(hours=1))
        ).all()
        reviews_rows = session.exec(
            select(Review.reviewed_at)
            .where(Review.user_id == user.id, Review.reviewed_at >= start, Review.reviewed_at <= end + timedelta(hours=1))
        ).all()

        word_counts: dict[datetime, int] = {dt: 0 for dt in buckets}
        review_counts: dict[datetime, int] = {dt: 0 for dt in buckets}

        for created_at in words_rows:
            if not created_at:
                continue
            key = created_at.replace(minute=0, second=0, microsecond=0)
            if key in word_counts:
                word_counts[key] += 1

        for reviewed_at in reviews_rows:
            if not reviewed_at:
                continue
            key = reviewed_at.replace(minute=0, second=0, microsecond=0)
            if key in review_counts:
                review_counts[key] += 1

        new_words = [word_counts[dt] for dt in buckets]
        reviews = [review_counts[dt] for dt in buckets]
        return StatsSeriesOut(labels=labels, new_words=new_words, reviews=reviews)

    days = int(range_key[:-1])
    start_day = date.today() - timedelta(days=days - 1)
    start_dt = datetime.combine(start_day, datetime.min.time())
    end_dt = datetime.combine(date.today(), datetime.max.time())
    bucket_days = [start_day + timedelta(days=i) for i in range(days)]
    labels = [d.strftime("%b %d") for d in bucket_days]

    words_rows = session.exec(
        select(Word.created_at)
        .where(Word.user_id == user.id, Word.created_at >= start_dt, Word.created_at <= end_dt)
    ).all()
    reviews_rows = session.exec(
        select(Review.reviewed_at)
        .where(Review.user_id == user.id, Review.reviewed_at >= start_dt, Review.reviewed_at <= end_dt)
    ).all()

    word_counts_day: dict[date, int] = {d: 0 for d in bucket_days}
    review_counts_day: dict[date, int] = {d: 0 for d in bucket_days}

    for created_at in words_rows:
        if not created_at:
            continue
        key = created_at.date()
        if key in word_counts_day:
            word_counts_day[key] += 1

    for reviewed_at in reviews_rows:
        if not reviewed_at:
            continue
        key = reviewed_at.date()
        if key in review_counts_day:
            review_counts_day[key] += 1

    new_words = [word_counts_day[d] for d in bucket_days]
    reviews = [review_counts_day[d] for d in bucket_days]
    return StatsSeriesOut(labels=labels, new_words=new_words, reviews=reviews)


def _mask_email(email: str) -> str:
    """
    Маскируем email для публичного рейтинга, чтобы не светить полный адрес.
    """
    value = (email or "").strip()
    if "@" not in value:
        return "User"
    local, domain = value.split("@", 1)
    local = local.strip()
    domain = domain.strip()
    if not local:
        return f"*@{domain}" if domain else "User"
    if len(local) <= 2:
        return f"{local[0]}***@{domain}" if domain else f"{local[0]}***"
    return f"{local[0]}***{local[-1]}@{domain}" if domain else f"{local[0]}***{local[-1]}"


@router.get("/leaderboard", response_model=list[LeaderboardEntryOut])
def leaderboard(
    limit: int = 10,
    range_key: str = Query(default="7d", alias="range"),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[LeaderboardEntryOut]:
    """
    Рейтинг пользователей: кто больше слов "выучил" (stage == MAX_STAGE).
    """
    return _get_leaderboard(session=session, limit=limit, range_key=range_key)


def _get_leaderboard(
    *,
    session: Session,
    limit: int = 10,
    range_key: str = "7d",
) -> list[LeaderboardEntryOut]:
    """
    Внутренняя функция рейтинга (без FastAPI Query/Depends), чтобы её было проще проверять.
    """
    safe_limit = max(1, min(int(limit or 10), 50))
    allowed = {"7d", "30d", "365d", "all"}
    if range_key not in allowed:
        range_key = "7d"

    start_dt: Optional[datetime] = None
    if range_key != "all":
        days = int(range_key[:-1])
        start_dt = datetime.now() - timedelta(days=days)

    conditions = [Word.stage == MAX_STAGE]
    if start_dt is not None:
        conditions.append(Word.mastered_at.is_not(None))
        conditions.append(Word.mastered_at >= start_dt)

    learned_count = func.coalesce(
        func.sum(case((and_(*conditions), 1), else_=0)),
        0,
    ).label("learned_words")

    rows = session.exec(
        select(User.email, learned_count)
        .join(Word, Word.user_id == User.id, isouter=True)
        .group_by(User.id)
        .order_by(desc(learned_count), User.email)
        .limit(safe_limit)
    ).all()

    return [
        LeaderboardEntryOut(user=_mask_email(email), learned_words=int(count or 0))
        for (email, count) in rows
    ]

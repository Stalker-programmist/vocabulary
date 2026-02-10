"""
scripts/selfcheck.py

Простой набор самопроверок логики проекта без тестовых фреймворков.
Запуск:
  python scripts/selfcheck.py
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from pathlib import Path
import sys


class SkipCheck(Exception):
    pass


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


# Когда скрипт запускается как `python scripts/selfcheck.py`,
# текущая директория в sys.path указывает на `scripts/`, поэтому добавляем корень проекта.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def check_mask_email() -> None:
    try:
        from app.routes.api import _mask_email
    except Exception as exc:
        raise SkipCheck(f"cannot import app: {exc}") from exc

    masked = _mask_email("alpha@example.com")
    _require("***" in masked, "mask_email: expected stars")
    _require("@example.com" in masked, "mask_email: expected domain preserved")


def check_leaderboard_ranges() -> None:
    try:
        from sqlmodel import Session, SQLModel, create_engine
    except Exception as exc:
        raise SkipCheck(f"sqlmodel missing: {exc}") from exc

    from app.models import User, Word
    from app.routes.api import _get_leaderboard
    from app.security import hash_password
    from app.services.review import MAX_STAGE

    engine = create_engine("sqlite:///:memory:", echo=False)
    SQLModel.metadata.create_all(engine)

    now = datetime.now()
    with Session(engine) as session:
        users = [
            User(email="u1@example.com", password_hash=hash_password("x")),
            User(email="u2@example.com", password_hash=hash_password("x")),
            User(email="u0@example.com", password_hash=hash_password("x")),
        ]
        session.add_all(users)
        session.commit()
        for u in users:
            session.refresh(u)

        u1, u2, u0 = users

        # u1: 2 mastered in week, 2 more in month, 1 old
        mastered_days = [1, 3, 12, 20, 200]
        words = []
        for idx, days_back in enumerate(mastered_days, start=1):
            words.append(
                Word(
                    user_id=u1.id,
                    term=f"w{idx}",
                    translation=f"t{idx}",
                    stage=MAX_STAGE,
                    next_review=date.today(),
                    mastered_at=now - timedelta(days=days_back),
                )
            )
        # u2: 1 mastered in week
        words.append(
            Word(
                user_id=u2.id,
                term="u2w1",
                translation="u2t1",
                stage=MAX_STAGE,
                next_review=date.today(),
                mastered_at=now - timedelta(days=2),
            )
        )
        # u0: 0 mastered (still should appear)
        words.append(
            Word(
                user_id=u0.id,
                term="u0w1",
                translation="u0t1",
                stage=0,
                next_review=date.today(),
                mastered_at=None,
            )
        )

        session.add_all(words)
        session.commit()

        week = _get_leaderboard(session=session, range_key="7d", limit=10)
        month = _get_leaderboard(session=session, range_key="30d", limit=10)
        year = _get_leaderboard(session=session, range_key="365d", limit=10)
        all_time = _get_leaderboard(session=session, range_key="all", limit=10)

        # Должны быть пользователи с нулём.
        _require(any(row.learned_words == 0 for row in all_time), "leaderboard: expected 0 user")

        # У u1: week=2, month=4, year=5, all=5
        top_all = all_time[0].learned_words if all_time else -1
        _require(top_all == 5, "leaderboard(all): expected top=5")

        top_week = week[0].learned_words if week else -1
        _require(top_week == 2, "leaderboard(7d): expected top=2")

        top_month = month[0].learned_words if month else -1
        _require(top_month == 4, "leaderboard(30d): expected top=4")

        top_year = year[0].learned_words if year else -1
        _require(top_year == 5, "leaderboard(365d): expected top=5")


def main() -> int:
    checks = [
        ("mask_email", check_mask_email),
        ("leaderboard_ranges", check_leaderboard_ranges),
    ]

    failed = 0
    skipped = 0
    for name, fn in checks:
        try:
            fn()
            print(f"OK  {name}")
        except SkipCheck as exc:
            skipped += 1
            print(f"SKIP {name}: {exc}")
        except Exception as exc:
            failed += 1
            print(f"FAIL {name}: {exc}")

    if skipped:
        print(f"Skipped: {skipped}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import text
from sqlmodel import SQLModel, Session, create_engine, select

DATABASE_URL = "sqlite:///./vocabulary.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}, echo=False
)


def migrate_db() -> None:
    """
    Minimal in-place migrations for local SQLite.
    (SQLModel doesn't manage schema ALTERs.)
    """
    with engine.begin() as conn:
        tables = {
            row[0]
            for row in conn.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        if "user" in tables and "users" not in tables:
            conn.exec_driver_sql("ALTER TABLE user RENAME TO users")

        if "word" in tables:
            columns = conn.exec_driver_sql("PRAGMA table_info(word)").fetchall()
            column_names = {row[1] for row in columns}  # row[1] = name
            if "user_id" not in column_names:
                conn.exec_driver_sql("ALTER TABLE word ADD COLUMN user_id INTEGER")
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_word_user_id ON word(user_id)"
            )
            if "starred" not in column_names:
                conn.exec_driver_sql(
                    "ALTER TABLE word ADD COLUMN starred INTEGER NOT NULL DEFAULT 0"
                )
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_word_starred ON word(starred)"
            )
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_word_user_id_starred ON word(user_id, starred)"
            )
            if "mastered_at" not in column_names:
                conn.exec_driver_sql("ALTER TABLE word ADD COLUMN mastered_at DATETIME")
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_word_mastered_at ON word(mastered_at)"
            )

        if "review" in tables:
            columns = conn.exec_driver_sql("PRAGMA table_info(review)").fetchall()
            column_names = {row[1] for row in columns}
            if "user_id" not in column_names:
                conn.exec_driver_sql("ALTER TABLE review ADD COLUMN user_id INTEGER")
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_review_user_id ON review(user_id)"
            )


def claim_legacy_words_for_user(user_id: int) -> None:
    """
    One-time migration helper: if there are legacy words without user_id,
    and no words have been claimed yet, assign them to this user.
    """
    with engine.begin() as conn:
        any_claimed = conn.execute(
            text("SELECT 1 FROM word WHERE user_id IS NOT NULL LIMIT 1")
        ).fetchone()
        if any_claimed:
            return
        conn.execute(text("UPDATE word SET user_id = :uid WHERE user_id IS NULL"), {"uid": user_id})


def init_db() -> None:
    migrate_db()
    SQLModel.metadata.create_all(engine)
    seed_demo_data()


def seed_demo_data() -> None:
    """
    Добавляем тестовых пользователей и слова для демо (однократно).
    - user_top20: 20 слов выучено
    - user_top5: 5 слов выучено
    """
    from .models import User, Word  # локальный импорт, чтобы избежать циклов
    from .security import hash_password
    from .services.review import MAX_STAGE

    now = datetime.now()
    today = date.today()

    demo_users = [
        ("top20@wordflow.local", 20),
        ("top5@wordflow.local", 5),
    ]

    with Session(engine) as session:
        existing = {
            user.email
            for user in session.exec(
                select(User).where(User.email.in_([email for email, _ in demo_users]))
            ).all()
        }

        for email, learned_count in demo_users:
            if email in existing:
                continue

            user = User(email=email, password_hash=hash_password("test1234"))
            session.add(user)
            session.commit()
            session.refresh(user)

            words: list[Word] = []
            for i in range(learned_count):
                # Распределяем даты освоения по неделе/месяцу/году.
                if i < max(1, learned_count // 2):
                    mastered_at = now - timedelta(days=(i % 6))  # в пределах недели
                elif i < max(2, (learned_count * 3) // 4):
                    mastered_at = now - timedelta(days=10 + (i % 15))  # в пределах месяца
                else:
                    mastered_at = now - timedelta(days=60 + (i % 200))  # в пределах года

                term = f"demo_{user.id}_{i+1}"
                translation = f"meaning_{i+1}"
                words.append(
                    Word(
                        user_id=user.id,
                        term=term,
                        translation=translation,
                        example=None,
                        tags="demo",
                        starred=False,
                        stage=MAX_STAGE,
                        next_review=today,
                        mastered_at=mastered_at,
                    )
                )

            session.add_all(words)
            session.commit()

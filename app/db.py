from __future__ import annotations

from sqlalchemy import text
from sqlmodel import SQLModel, create_engine

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

        columns = conn.exec_driver_sql("PRAGMA table_info(word)").fetchall()
        column_names = {row[1] for row in columns}  # row[1] = name
        if "user_id" not in column_names:
            conn.exec_driver_sql("ALTER TABLE word ADD COLUMN user_id INTEGER")
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_word_user_id ON word(user_id)"
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
    SQLModel.metadata.create_all(engine)
    migrate_db()

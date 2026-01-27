from __future__ import annotations

from sqlalchemy import text
from sqlmodel import SQLModel, create_engine

DATABASE_URL = "sqlite:///./vocabulary.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}, echo=False
)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    with engine.begin() as conn:
        columns = conn.execute(text("PRAGMA table_info(word)")).fetchall()
        col_names = {row[1] for row in columns}
        if "user_id" not in col_names:
            conn.execute(text("ALTER TABLE word ADD COLUMN user_id INTEGER"))

        columns = conn.execute(text("PRAGMA table_info(review)")).fetchall()
        col_names = {row[1] for row in columns}
        if "user_id" not in col_names:
            conn.execute(text("ALTER TABLE review ADD COLUMN user_id INTEGER"))


from __future__ import annotations

from sqlmodel import SQLModel, create_engine

DATABASE_URL = "sqlite:///./vocabulary.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}, echo=False
)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


"""
sa_db.py
SQLAlchemy 2.0 engine/session helpers.

Файл добавлен для будущей миграции на чистый SQLAlchemy (по ТЗ).
Текущий код проекта использует SQLModel (см. `app/db.py`).
"""

from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .sa_models import Base


DATABASE_URL = "sqlite:///./vocabulary.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, echo=False)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_sa_db() -> None:
    Base.metadata.create_all(engine)


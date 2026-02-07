from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.now)


class Word(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
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
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    reviewed_at: datetime = Field(default_factory=datetime.now)
    result: bool
    next_review_assigned: date

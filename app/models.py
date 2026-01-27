from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


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


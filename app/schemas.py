from __future__ import annotations

from typing import Optional

from sqlmodel import SQLModel


class WordCreate(SQLModel):
    term: str
    translation: str
    example: Optional[str] = None
    tags: Optional[str] = None


class WordUpdate(SQLModel):
    term: Optional[str] = None
    translation: Optional[str] = None
    example: Optional[str] = None
    tags: Optional[str] = None


class ReviewResult(SQLModel):
    result: str


class StatsOut(SQLModel):
    today_due_count: int
    reviewed_today_count: int
    new_words_7d: int
    due_next_7d: int


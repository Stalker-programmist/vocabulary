from __future__ import annotations

from typing import Optional

from sqlmodel import SQLModel


class AuthRegister(SQLModel):
    email: str
    password: str


class AuthVerify(SQLModel):
    email: str
    code: str


class AuthLogin(SQLModel):
    email: str
    password: str


class AuthToken(SQLModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(SQLModel):
    id: int
    email: str
    is_verified: bool


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
    new_words_1d: int
    new_words_7d: int
    new_words_30d: int
    new_words_365d: int
    reviews_1d: int
    reviews_7d: int
    reviews_30d: int
    reviews_365d: int
    due_next_7d: int


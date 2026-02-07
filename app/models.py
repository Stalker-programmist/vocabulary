from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
<<<<<<< HEAD
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True)
    password_hash: str
=======
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    password_hash: str
    is_verified: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.now)


class VerificationCode(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    code: str
    expires_at: datetime
>>>>>>> dce23febdb3bb8efd7e33cacfdea52a2dd384518
    created_at: datetime = Field(default_factory=datetime.now)


class Word(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
<<<<<<< HEAD
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
=======
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
>>>>>>> dce23febdb3bb8efd7e33cacfdea52a2dd384518
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
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    reviewed_at: datetime = Field(default_factory=datetime.now)
    result: bool
    next_review_assigned: date

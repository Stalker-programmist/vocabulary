from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select

from ..db import claim_legacy_words_for_user
from ..deps import get_current_user, get_session
from ..models import User
from ..security import hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def normalize_email(email: str) -> str:
    return email.strip().lower()


@router.get("/me")
def me(user: User = Depends(get_current_user)) -> dict:
    return {"id": user.id, "email": user.email, "created_at": user.created_at}


@router.post("/register", status_code=201)
def register(
    request: Request,
    payload: dict,
    session: Session = Depends(get_session),
) -> dict:
    email_raw = payload.get("email")
    password = payload.get("password")
    if not isinstance(email_raw, str) or not isinstance(password, str):
        raise HTTPException(status_code=400, detail="Invalid payload")
    email = normalize_email(email_raw)
    if "@" not in email or len(email) < 5:
        raise HTTPException(status_code=400, detail="Invalid email")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password too short")

    existing = session.exec(select(User).where(User.email == email)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(email=email, password_hash=hash_password(password))
    session.add(user)
    session.commit()
    session.refresh(user)

    request.session["uid"] = user.id
    claim_legacy_words_for_user(user.id)

    return {"id": user.id, "email": user.email}


@router.post("/login")
def login(
    request: Request,
    payload: dict,
    session: Session = Depends(get_session),
) -> dict:
    email_raw = payload.get("email")
    password = payload.get("password")
    if not isinstance(email_raw, str) or not isinstance(password, str):
        raise HTTPException(status_code=400, detail="Invalid payload")
    email = normalize_email(email_raw)

    user: Optional[User] = session.exec(select(User).where(User.email == email)).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    request.session["uid"] = user.id
    claim_legacy_words_for_user(user.id)

    return {"id": user.id, "email": user.email}


@router.post("/logout")
def logout(request: Request) -> dict:
    request.session.clear()
    return {"ok": True}


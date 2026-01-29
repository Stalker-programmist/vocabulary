from __future__ import annotations

from typing import Generator, Optional

from fastapi import Depends, HTTPException, Request
from sqlmodel import Session

from .db import engine
from .models import User


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


def get_optional_user(
    request: Request, session: Session = Depends(get_session)
) -> Optional[User]:
    uid = request.session.get("uid")
    if not uid:
        return None
    user = session.get(User, uid)
    if not user:
        request.session.clear()
        return None
    return user


def get_current_user(
    request: Request, session: Session = Depends(get_session)
) -> User:
    user = get_optional_user(request, session)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


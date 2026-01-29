from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app.db import init_db
from app.routes.auth import router as auth_router
from app.routes.api import router as api_router
from app.routes.pages import router as pages_router
from app.settings import STATIC_DIR
from app.settings import SESSION_SECRET


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Vocabulary Trainer", version="0.1.0", lifespan=lifespan)
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET, same_site="lax")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.include_router(pages_router)
app.include_router(auth_router)
app.include_router(api_router)

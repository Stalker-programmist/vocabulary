from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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


@app.middleware("http")
async def disable_static_cache(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/static/"):
        # В dev-режиме это упрощает отладку: браузер не будет «держать» старые JS/CSS.
        response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/favicon.ico", include_in_schema=False)
def favicon_ico():
    return FileResponse(STATIC_DIR / "favicon.ico")


@app.get("/favicon.svg", include_in_schema=False)
def favicon_svg():
    return FileResponse(STATIC_DIR / "favicon.svg", media_type="image/svg+xml")

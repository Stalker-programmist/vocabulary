from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import FileResponse

from ..settings import STATIC_DIR

router = APIRouter()


@router.get("/", include_in_schema=False)
def read_index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


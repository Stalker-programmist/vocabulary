from __future__ import annotations

from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parents[1]
STATIC_DIR = BASE_DIR / "static"

SESSION_SECRET = os.environ.get("SESSION_SECRET") or "dev-session-secret-change-me"

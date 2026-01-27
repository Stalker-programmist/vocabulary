from __future__ import annotations

from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parents[1]
STATIC_DIR = BASE_DIR / "static"

JWT_SECRET = os.getenv("VOCABULARY_JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("VOCABULARY_JWT_EXPIRE_MINUTES", "60"))

SMTP_HOST = os.getenv("VOCABULARY_SMTP_HOST", "smtp.yandex.com")
SMTP_PORT = int(os.getenv("VOCABULARY_SMTP_PORT", "465"))
SMTP_USER = os.getenv("VOCABULARY_SMTP_USER", "")
SMTP_PASSWORD = os.getenv("VOCABULARY_SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("VOCABULARY_SMTP_FROM", SMTP_USER)


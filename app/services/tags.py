from __future__ import annotations

from typing import Optional


def normalize_tags(tags: Optional[str]) -> Optional[str]:
    if tags is None:
        return None
    parts = [part.strip().lower() for part in tags.split(",") if part.strip()]
    if not parts:
        return None
    return ",".join(parts)


def normalize_tag(tag: Optional[str]) -> Optional[str]:
    if not tag:
        return None
    parts = [part.strip().lower() for part in tag.split(",") if part.strip()]
    if not parts:
        return None
    return parts[0]


from __future__ import annotations

from datetime import date, timedelta

STAGE_INTERVALS = [1, 3, 7, 14, 30]
MAX_STAGE = len(STAGE_INTERVALS) - 1


def next_review_date(stage: int, today: date) -> date:
    interval = STAGE_INTERVALS[stage]
    return today + timedelta(days=interval)


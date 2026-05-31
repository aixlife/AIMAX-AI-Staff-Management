"""서로이웃 일일 신청 카운터.

네이버 공식 한도는 하루 100명(2026-04 기준). 공식 한도보다 보수적으로 설정해
계정 리스크를 낮춘다. 날짜가 바뀌면 자동 리셋된다.

저장 위치: APP_DATA_DIR/neighbor_quota.json
형식: {"date": "YYYY-MM-DD", "count": N, "naver_id": "..."}

네이버 ID별로 분리 저장하여 다중 계정 사용 시에도 정확히 집계된다.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from paths import APP_DATA_DIR
from utils.logger import get_logger

logger = get_logger(__name__)

_QUOTA_FILE: Path = APP_DATA_DIR / "neighbor_quota.json"


def _today_str() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def _load_all() -> dict:
    if not _QUOTA_FILE.exists():
        return {}
    try:
        with open(_QUOTA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                return data
    except (OSError, json.JSONDecodeError) as e:
        logger.warning(f"quota 파일 읽기 실패, 초기화: {e}")
    return {}


def _save_all(data: dict) -> None:
    try:
        _QUOTA_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(_QUOTA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except OSError as e:
        logger.warning(f"quota 파일 저장 실패: {e}")


def _key(naver_id: Optional[str]) -> str:
    return (naver_id or "_default").strip().lower()


def get_today_count(naver_id: Optional[str] = None) -> int:
    """오늘 신청한 서로이웃 수를 반환. 날짜가 바뀌었으면 0."""
    data = _load_all()
    entry = data.get(_key(naver_id))
    if not entry:
        return 0
    if entry.get("date") != _today_str():
        return 0
    return int(entry.get("count", 0))


def increment(naver_id: Optional[str] = None, delta: int = 1) -> int:
    """오늘 카운터를 delta만큼 증가시키고 새 값을 반환."""
    data = _load_all()
    key = _key(naver_id)
    today = _today_str()
    entry = data.get(key)
    if not entry or entry.get("date") != today:
        entry = {"date": today, "count": 0}
    entry["count"] = int(entry.get("count", 0)) + delta
    data[key] = entry
    _save_all(data)
    return entry["count"]


def remaining(daily_limit: int, naver_id: Optional[str] = None) -> int:
    """오늘 남은 신청 가능 수."""
    return max(0, daily_limit - get_today_count(naver_id))

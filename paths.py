"""플랫폼별 쓰기/읽기 디렉토리를 한 곳에서 정의.

- BUNDLE_DIR: 읽기 전용 번들 리소스 (config.yaml 기본값, 정적 데이터)
- APP_DATA_DIR: 사용자별 쓰기 가능 디렉토리 (쿠키, 설정, 로그, 디버그)

Frozen 실행(Nuitka/PyInstaller)과 dev 실행 모두 올바른 경로를 반환한다.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

APP_NAME = "NaverBlogAuto"


def _is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False)) or "__compiled__" in globals() or hasattr(sys, "_MEIPASS")


def _bundle_dir() -> Path:
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        return Path(meipass)
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent
    return Path(__file__).resolve().parent


def _app_data_dir() -> Path:
    if sys.platform.startswith("win"):
        base = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
        return Path(base) / APP_NAME
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / APP_NAME
    xdg = os.environ.get("XDG_DATA_HOME") or str(Path.home() / ".local" / "share")
    return Path(xdg) / APP_NAME


IS_FROZEN: bool = _is_frozen()
BUNDLE_DIR: Path = _bundle_dir()
APP_DATA_DIR: Path = _app_data_dir()

SESSIONS_DIR: Path = APP_DATA_DIR / "sessions"
DEBUG_DIR: Path = APP_DATA_DIR / "debug"
LOGS_DIR: Path = APP_DATA_DIR / "logs"
# AI가 생성한(과금된) 원고를 네이버 입력 전에 따로 보관 — 발행 실패 시에도 재사용 가능
GENERATED_DIR: Path = APP_DATA_DIR / "generated"
STYLE_PROFILES_DIR: Path = APP_DATA_DIR / "style_profiles"
BROWSER_PROFILES_DIR: Path = APP_DATA_DIR / "browser_profiles"
REPORTS_DIR: Path = APP_DATA_DIR / "reports"
PENDING_REPORTS_DIR: Path = REPORTS_DIR / "pending"
SENT_REPORTS_DIR: Path = REPORTS_DIR / "sent"
SETTINGS_PATH: Path = APP_DATA_DIR / "settings.json"
ENV_PATH: Path = APP_DATA_DIR / ".env"
USER_CONFIG_PATH: Path = APP_DATA_DIR / "config.yaml"
BUNDLED_CONFIG_PATH: Path = BUNDLE_DIR / "config.yaml"


def _safe_dir(path: Path) -> Path:
    if path.exists() and not path.is_dir():
        return path.with_name(f"{path.name}_data")
    return path


SESSIONS_DIR = _safe_dir(SESSIONS_DIR)
DEBUG_DIR = _safe_dir(DEBUG_DIR)
LOGS_DIR = _safe_dir(LOGS_DIR)
STYLE_PROFILES_DIR = _safe_dir(STYLE_PROFILES_DIR)
BROWSER_PROFILES_DIR = _safe_dir(BROWSER_PROFILES_DIR)
REPORTS_DIR = _safe_dir(REPORTS_DIR)
PENDING_REPORTS_DIR = _safe_dir(PENDING_REPORTS_DIR)
SENT_REPORTS_DIR = _safe_dir(SENT_REPORTS_DIR)


def ensure_dirs() -> None:
    try:
        APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    except OSError:
        pass
    for name in (
        "SESSIONS_DIR",
        "DEBUG_DIR",
        "LOGS_DIR",
        "GENERATED_DIR",
        "STYLE_PROFILES_DIR",
        "BROWSER_PROFILES_DIR",
        "REPORTS_DIR",
        "PENDING_REPORTS_DIR",
        "SENT_REPORTS_DIR",
    ):
        d = globals()[name]
        try:
            d.mkdir(parents=True, exist_ok=True)
        except FileExistsError:
            d = d.with_name(f"{d.name}_data")
            globals()[name] = d
            try:
                d.mkdir(parents=True, exist_ok=True)
            except OSError:
                pass
        except OSError:
            pass


ensure_dirs()

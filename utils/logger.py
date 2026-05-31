import logging
import sys
from logging.handlers import RotatingFileHandler

from paths import LOGS_DIR


LOG_FILE_PATH = LOGS_DIR / "aimax.log"


def _make_formatter():
    return logging.Formatter(
        "[%(asctime)s] %(levelname)s - %(name)s - %(message)s",
        datefmt="%H:%M:%S",
    )


def configure_file_logging(max_bytes=1_000_000, backup_count=3):
    """Attach an app-wide rotating file log handler once."""
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    root_logger = logging.getLogger()
    for handler in root_logger.handlers:
        if getattr(handler, "_aimax_file_handler", False):
            return LOG_FILE_PATH

    handler = RotatingFileHandler(
        LOG_FILE_PATH,
        maxBytes=max_bytes,
        backupCount=backup_count,
        encoding="utf-8",
    )
    handler._aimax_file_handler = True
    handler.setFormatter(_make_formatter())
    root_logger.addHandler(handler)
    if root_logger.level in (logging.NOTSET, 0) or root_logger.level > logging.INFO:
        root_logger.setLevel(logging.INFO)
    return LOG_FILE_PATH


def get_logger(name=None):
    """통일된 로거 생성"""
    logger = logging.getLogger(name or "naver_blog")
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(_make_formatter())
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger

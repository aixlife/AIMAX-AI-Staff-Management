"""네이버 블로그 키워드 검색 → 블로거 ID / 이메일 수집 크롤러."""
import csv
import os
import random
import re
import time
from datetime import datetime
from pathlib import Path

from browser.human_actions import human_scroll
from constants import NAVER_SEARCH_BLOG_URL
from paths import APP_DATA_DIR
from utils.delays import wait_medium, wait_short
from utils.logger import get_logger

logger = get_logger(__name__)

EXPORTS_DIR = APP_DATA_DIR / "exports"

_RESERVED = {
    'PostView', 'PostList', 'GoBlogWrite', 'BuddyAddFormBridge',
    'BuddyAddForm', 'prologue', 'MyBlog', 'blogId', 'search',
    'login', 'logout', 'api', 'static', 'CommentList', 'TagList',
    'SympathyList', 'VisitBlog',
}


def _extract_blog_id(url: str) -> str | None:
    match = re.search(r'blog\.naver\.com/([a-zA-Z0-9_]+)', url)
    if match:
        bid = match.group(1)
        if bid not in _RESERVED and len(bid) >= 4:
            return bid
    return None


def _collect_ids_from_source(page_source: str) -> list[str]:
    """page_source 정규식으로 blog.naver.com/{id} 패턴 순서대로 추출."""
    ids: list[str] = []
    for bid in re.findall(r'blog\.naver\.com/([a-zA-Z0-9_]{4,20})', page_source):
        if bid not in _RESERVED and bid not in ids:
            ids.append(bid)
    return ids


def scrape_blogger_ids(driver, keyword: str, max_results: int = 50,
                       scroll_pages: int = 4) -> list[str]:
    """키워드 검색 → 블로거 ID 목록 반환 (검색결과 등장 순서 유지)."""
    logger.info(f"블로거 ID 수집 시작: '{keyword}' (최대 {max_results}명)")
    driver.get(NAVER_SEARCH_BLOG_URL + keyword)
    wait_medium()

    all_ids: list[str] = []

    for _ in range(scroll_pages):
        for bid in _collect_ids_from_source(driver.page_source):
            if bid not in all_ids:
                all_ids.append(bid)

        if len(all_ids) >= max_results:
            break

        human_scroll(driver, random.randint(600, 1000))
        wait_short()

    result = all_ids[:max_results]
    logger.info(f"블로거 ID {len(result)}명 수집 완료: '{keyword}'")
    return result


def scrape_blogger_emails(driver, keyword: str, max_results: int = 50) -> list[str]:
    """키워드 검색 → `아이디@naver.com` 이메일 목록 반환."""
    ids = scrape_blogger_ids(driver, keyword, max_results=max_results)
    return [f"{bid}@naver.com" for bid in ids]


def save_to_csv(keyword: str, ids: list[str], include_email: bool = True) -> str:
    """수집 결과를 CSV로 저장 → 파일 경로 반환."""
    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_kw = re.sub(r'[^\w가-힣]', '_', keyword)
    filepath = EXPORTS_DIR / f"blog_{safe_kw}_{ts}.csv"

    with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        if include_email:
            writer.writerow(["블로그ID", "이메일"])
            for bid in ids:
                writer.writerow([bid, f"{bid}@naver.com"])
        else:
            writer.writerow(["블로그ID"])
            for bid in ids:
                writer.writerow([bid])

    logger.info(f"CSV 저장 완료: {filepath}")
    return str(filepath)

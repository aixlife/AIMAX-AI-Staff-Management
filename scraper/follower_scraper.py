"""특정 블로거의 이웃 목록에서 blog_id 수집."""
from __future__ import annotations

import html
import random
import re
import time
from typing import Iterable, Optional
from urllib.parse import unquote

try:
    from utils.delays import is_stop_requested, wait_medium, wait_short
except Exception:
    def is_stop_requested(stop_event=None):
        return bool(stop_event and stop_event.is_set())

    def _fallback_wait(seconds, stop_event=None):
        if is_stop_requested(stop_event):
            return False
        time.sleep(seconds)
        return not is_stop_requested(stop_event)

    def wait_short(stop_event=None):
        return _fallback_wait(1.0, stop_event=stop_event)

    def wait_medium(stop_event=None):
        return _fallback_wait(1.5, stop_event=stop_event)

try:
    from utils.logger import get_logger
except Exception:
    import logging

    def get_logger(name):
        return logging.getLogger(name)

logger = get_logger(__name__)

_MOBILE_BUDDY_LIST_URL = "https://m.blog.naver.com/BuddyList.naver?blogId={blog_id}"
_MAX_SCROLL_ROUNDS = 14
_STABLE_ROUNDS_LIMIT = 4

_RESERVED_BLOG_IDS = {
    "PostView", "PostList", "GoBlogWrite", "BuddyAddFormBridge",
    "BuddyAddForm", "prologue", "MyBlog", "blogId", "search",
    "login", "logout", "api", "static", "CommentList", "TagList",
    "SympathyList", "VisitBlog", "BuddyList",
}
_RESERVED_BLOG_IDS_LOWER = {blog_id.lower() for blog_id in _RESERVED_BLOG_IDS}

_BLOCKED_OR_PRIVATE_PATTERNS = (
    "이웃 목록을 공개하지",
    "공개하지 않는",
    "비공개",
    "접근할 수",
    "존재하지 않는",
    "삭제되었거나",
    "로그인이 필요",
)

_MORE_BUTTON_XPATHS = (
    "//button[contains(normalize-space(.), '더보기') or contains(normalize-space(.), '더 보기')]",
    "//a[contains(normalize-space(.), '더보기') or contains(normalize-space(.), '더 보기')]",
    "//button[contains(normalize-space(.), '다음')]",
    "//a[contains(normalize-space(.), '다음')]",
)


def scrape_follower_ids(
    driver,
    blogger_url: str,
    max_count: int = 30,
    include_neighbors: bool = True,
    include_mutual: bool = True,
    stop_event=None,
) -> list[str]:
    """특정 블로거의 이웃 목록에서 blog_id 리스트 수집.

    Args:
        driver: Selenium WebDriver (로그인 상태)
        blogger_url: 대상 블로거의 블로그 URL 또는 ID
        max_count: 수집할 최대 ID 개수
        include_neighbors: 일반 이웃 포함 여부. 현재 모바일 BuddyList가 공개한 목록 기준.
        include_mutual: 서로이웃 포함 여부. 네이버 공개 목록에서 구분 가능할 때 함께 수집.
        stop_event: threading.Event — set되면 즉시 중단

    Returns:
        수집된 blog_id 리스트. 중복 제거, 비공개는 제외.
    """
    if is_stop_requested(stop_event):
        return []

    if not include_neighbors and not include_mutual:
        logger.warning("이웃/서로이웃 수집 옵션이 모두 꺼져 있습니다")
        return []

    owner_id = extract_blogger_id_from_url(blogger_url)
    if not owner_id:
        raise ValueError("블로거 링크 또는 ID를 확인할 수 없습니다")

    max_count = max(1, int(max_count or 1))
    url = _MOBILE_BUDDY_LIST_URL.format(blog_id=owner_id)
    logger.info(f"특정 블로거 이웃 목록 수집 시작: {owner_id} (최대 {max_count}명)")
    driver.get(url)
    if not wait_medium(stop_event=stop_event):
        return []

    collected: list[str] = []
    seen = set()
    stable_rounds = 0
    previous_count = 0
    previous_height = 0

    for round_idx in range(_MAX_SCROLL_ROUNDS):
        if is_stop_requested(stop_event):
            break

        for blog_id in _extract_ids_from_source(driver.page_source, owner_id=owner_id):
            if blog_id not in seen:
                seen.add(blog_id)
                collected.append(blog_id)
                if len(collected) >= max_count:
                    logger.info(f"특정 블로거 이웃 {len(collected)}명 수집 완료: {owner_id}")
                    return collected[:max_count]

        current_height = _get_scroll_height(driver)
        more_clicked = _click_more_button(driver, stop_event=stop_event)
        if not more_clicked:
            _scroll_list(driver, stop_event=stop_event)

        if len(collected) == previous_count and current_height == previous_height and not more_clicked:
            stable_rounds += 1
        else:
            stable_rounds = 0
        previous_count = len(collected)
        previous_height = current_height

        if stable_rounds >= _STABLE_ROUNDS_LIMIT:
            break

        logger.info(
            f"이웃 목록 탐색 중: {owner_id} "
            f"({round_idx + 1}/{_MAX_SCROLL_ROUNDS}, 현재 {len(collected)}명)"
        )

    if not collected:
        logger.warning(f"이웃 목록이 비공개이거나 접근 제한됨: {owner_id}")
    else:
        logger.info(f"특정 블로거 이웃 {len(collected)}명 수집 완료: {owner_id}")
    return collected[:max_count]


def extract_blogger_id_from_url(url: str) -> Optional[str]:
    """블로거 URL에서 blog_id 추출 — 이건 구현해둬도 안전.

    예:
        https://blog.naver.com/abc123 → "abc123"
        blog.naver.com/abc123/posts → "abc123"
        abc123 → "abc123"
    """
    if not url:
        return None
    url = html.unescape(unquote(url.strip())).strip()

    # PostView/BuddyList 같은 네이버 내부 URL은 query의 blogId가 실제 대상이다.
    match = re.search(r"(?:[?&]|&amp;)blogId=([a-zA-Z0-9_]{4,30})", url, re.I)
    if match:
        return _clean_blog_id(match.group(1))

    # 전체 URL 패턴: https://blog.naver.com/abc123, https://m.blog.naver.com/abc123
    match = re.search(r"(?:m\.)?blog\.naver\.com/([a-zA-Z0-9_]{4,30})(?:[/?#]|$)", url)
    if match:
        return _clean_blog_id(match.group(1))

    # ID만 입력한 경우 — 영숫자+_ 4자 이상
    if re.fullmatch(r"[a-zA-Z0-9_]{4,30}", url):
        return _clean_blog_id(url)

    return None


def _clean_blog_id(blog_id: str | None) -> Optional[str]:
    if not blog_id:
        return None
    blog_id = blog_id.strip().strip("/").strip()
    if blog_id.lower() in _RESERVED_BLOG_IDS_LOWER:
        return None
    if not re.fullmatch(r"[a-zA-Z0-9_]{4,30}", blog_id):
        return None
    return blog_id


def _normalize_source(source: str) -> str:
    source = html.unescape(source or "")
    source = source.replace("\\/", "/").replace("\\u002F", "/")
    return unquote(source)


def _extract_ids_from_source(page_source: str, owner_id: str = "") -> list[str]:
    """BuddyList HTML/스크립트에서 블로그 ID를 등장 순서대로 추출."""
    source = _normalize_source(page_source)
    patterns: Iterable[str] = (
        r"(?:[?&]|&amp;)blogId=([a-zA-Z0-9_]{4,30})",
        r"['\"]blogId['\"]\s*:\s*['\"]([a-zA-Z0-9_]{4,30})['\"]",
        r"(?:https?:)?//(?:m\.)?blog\.naver\.com/([a-zA-Z0-9_]{4,30})(?:[/?#\"'\s]|$)",
    )

    matches: list[tuple[int, str]] = []
    for pattern in patterns:
        for match in re.finditer(pattern, source, re.I):
            matches.append((match.start(), match.group(1)))
    matches.sort(key=lambda item: item[0])

    ids: list[str] = []
    owner_id = (owner_id or "").lower()
    for _, raw_id in matches:
        blog_id = _clean_blog_id(raw_id)
        if not blog_id:
            continue
        if owner_id and blog_id.lower() == owner_id:
            continue
        if blog_id not in ids:
            ids.append(blog_id)
    return ids


def _get_scroll_height(driver) -> int:
    try:
        return int(driver.execute_script("return document.body ? document.body.scrollHeight : 0;") or 0)
    except Exception:
        return 0


def _click_more_button(driver, stop_event=None) -> bool:
    try:
        from selenium.webdriver.common.by import By
    except Exception as e:
        logger.warning(f"더보기 버튼 탐색 불가 (Selenium import 실패): {e}")
        return False

    for xpath in _MORE_BUTTON_XPATHS:
        if is_stop_requested(stop_event):
            return False
        try:
            for element in driver.find_elements(By.XPATH, xpath):
                if not element.is_displayed() or not element.is_enabled():
                    continue
                text = (element.text or "").strip()
                if "이웃추가" in text:
                    continue
                driver.execute_script("arguments[0].click();", element)
                wait_short(stop_event=stop_event)
                return True
        except Exception:
            continue
    return False


def _scroll_list(driver, stop_event=None) -> None:
    try:
        from browser.human_actions import human_scroll
        human_scroll(driver, random.randint(700, 1200))
    except Exception:
        try:
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        except Exception:
            pass
    wait_short(stop_event=stop_event)


def _page_looks_private_or_blocked(driver) -> bool:
    try:
        text = driver.execute_script(
            "return document.body ? (document.body.innerText || document.body.textContent || '') : '';"
        )
    except Exception:
        text = ""
    return any(pattern in (text or "") for pattern in _BLOCKED_OR_PRIVATE_PATTERNS)

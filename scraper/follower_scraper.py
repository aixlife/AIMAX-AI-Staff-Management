"""특정 블로거의 공개 이웃 목록에서 blog_id 후보를 수집한다."""
from __future__ import annotations

import html
import re
import time
from typing import Optional
from urllib.parse import parse_qs, unquote, urlparse

from utils.logger import get_logger

logger = get_logger(__name__)

BUDDY_LIST_URL = "https://m.blog.naver.com/BuddyList.naver?blogId={blog_id}"

_BLOG_ID_RE = re.compile(r"^[A-Za-z0-9_]{2,50}$")
_RESERVED_BLOG_IDS = {
    "postview", "postlist", "buddylist", "buddyaddformbridge", "buddyaddform",
    "goblogwrite", "prologue", "myblog", "blogid", "login", "logout",
    "search", "api", "static", "commentlist", "taglist", "sympathylist",
    "visitblog", "category", "rss", "profile", "section", "postscript",
    "mapview", "photolist", "memolist", "guestbook",
}


def _is_stop_requested(stop_event) -> bool:
    try:
        from utils.delays import is_stop_requested
        return is_stop_requested(stop_event)
    except Exception:
        return bool(stop_event is not None and stop_event.is_set())


def _sleep_interruptible(seconds: float, stop_event=None) -> bool:
    try:
        from utils.delays import sleep_interruptible
        return sleep_interruptible(seconds, stop_event=stop_event)
    except Exception:
        end_time = time.time() + max(0.0, float(seconds or 0))
        while time.time() < end_time:
            if _is_stop_requested(stop_event):
                return False
            time.sleep(min(0.1, end_time - time.time()))
        return not _is_stop_requested(stop_event)


def _clean_candidate(value: str | None) -> str | None:
    if not value:
        return None
    value = unquote(str(value)).strip().strip("\"'<> ")
    if not value:
        return None
    if not _BLOG_ID_RE.fullmatch(value):
        return None
    if value.lower() in _RESERVED_BLOG_IDS:
        return None
    return value


def _looks_like_naver_blog_host(hostname: str | None) -> bool:
    hostname = (hostname or "").lower()
    return hostname in {"blog.naver.com", "m.blog.naver.com"}


def extract_blogger_id_from_url(url: str) -> Optional[str]:
    """블로그 URL 또는 ID에서 blog_id를 추출한다.

    blogId 쿼리 파라미터가 있으면 가장 먼저 사용한다.
    """
    if not url:
        return None

    raw = str(url).strip()
    if not raw:
        return None

    parse_target = raw
    if "blog.naver.com" in raw and not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", raw):
        parse_target = "https://" + raw.lstrip("/")

    parsed = urlparse(parse_target)
    query = parse_qs(parsed.query)
    for key, values in query.items():
        if key.lower() == "blogid":
            for value in values:
                candidate = _clean_candidate(value)
                if candidate:
                    return candidate

    if _looks_like_naver_blog_host(parsed.hostname):
        for part in parsed.path.split("/"):
            candidate = _clean_candidate(part)
            if candidate:
                return candidate

    return _clean_candidate(raw)


def _extract_ids_from_source(page_source: str, source_blog_id: str) -> list[str]:
    source = html.unescape(page_source or "")
    source = source.replace("\\/", "/")
    found: list[str] = []

    patterns = [
        r"[?&]blogId=([A-Za-z0-9_]{2,50})",
        r"['\"]blogId['\"]\s*:\s*['\"]([A-Za-z0-9_]{2,50})['\"]",
        r"https?://m\.blog\.naver\.com/([A-Za-z0-9_]{2,50})(?=[/?#\"'<\s]|$)",
        r"https?://blog\.naver\.com/([A-Za-z0-9_]{2,50})(?=[/?#\"'<\s]|$)",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, source, flags=re.I):
            candidate = _clean_candidate(match.group(1))
            if not candidate:
                continue
            if candidate.lower() == source_blog_id.lower():
                continue
            if candidate not in found:
                found.append(candidate)
    return found


def _click_more_button(driver, stop_event=None) -> bool:
    from selenium.webdriver.common.by import By

    labels = ("더보기", "더 보기", "다음")
    xpaths = [
        "//*[self::a or self::button][contains(normalize-space(.), '더보기')]",
        "//*[self::a or self::button][contains(normalize-space(.), '더 보기')]",
        "//*[self::a or self::button][contains(normalize-space(.), '다음')]",
    ]
    for xpath in xpaths:
        if _is_stop_requested(stop_event):
            return False
        try:
            elements = driver.find_elements(By.XPATH, xpath)
        except Exception:
            continue
        for element in elements:
            try:
                text = (element.text or "").strip()
                if text and not any(label in text for label in labels):
                    continue
                if not element.is_displayed() or not element.is_enabled():
                    continue
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
                if not _sleep_interruptible(0.2, stop_event=stop_event):
                    return False
                driver.execute_script("arguments[0].click();", element)
                return True
            except Exception:
                continue
    return False


def _scroll_for_more(driver):
    try:
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
    except Exception:
        pass


def scrape_follower_ids(
    driver,
    blogger_url: str,
    max_count: int = 30,
    include_neighbors: bool = True,
    include_mutual: bool = True,
    stop_event=None,
) -> list[str]:
    """특정 블로거의 공개 이웃 목록에서 blog_id 후보를 수집한다."""
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC

    del include_neighbors, include_mutual  # 모바일 BuddyList HTML에서 노출되는 공개 후보를 모두 수집한다.

    blog_id = extract_blogger_id_from_url(blogger_url)
    if not blog_id:
        logger.warning(f"블로거 링크/ID 형식을 인식하지 못했습니다: {blogger_url}")
        return []

    max_count = max(1, int(max_count or 1))
    target_url = BUDDY_LIST_URL.format(blog_id=blog_id)
    logger.info(f"블로거 ID 추출: {blog_id}")
    logger.info(f"공개 이웃 목록 접속: {target_url}")

    if _is_stop_requested(stop_event):
        return []

    driver.get(target_url)
    try:
        WebDriverWait(driver, 8).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "body"))
        )
    except Exception:
        pass

    if not _sleep_interruptible(1.0, stop_event=stop_event):
        return []

    collected: list[str] = []
    stagnant_rounds = 0
    last_source_len = 0

    for _ in range(24):
        if _is_stop_requested(stop_event):
            break

        ids = _extract_ids_from_source(driver.page_source, blog_id)
        before = len(collected)
        for candidate in ids:
            if candidate not in collected:
                collected.append(candidate)
                if len(collected) >= max_count:
                    break

        if len(collected) >= max_count:
            break

        source_len = len(driver.page_source or "")
        if len(collected) == before and source_len == last_source_len:
            stagnant_rounds += 1
        else:
            stagnant_rounds = 0
        last_source_len = source_len

        clicked = _click_more_button(driver, stop_event=stop_event)
        if clicked:
            if not _sleep_interruptible(1.0, stop_event=stop_event):
                break
            continue

        _scroll_for_more(driver)
        if not _sleep_interruptible(1.0, stop_event=stop_event):
            break

        if stagnant_rounds >= 3:
            break

    if collected:
        logger.info(f"공개 이웃 목록에서 후보 {len(collected)}명 수집")
    else:
        logger.warning("이웃 목록이 비공개이거나 접근 제한됨")

    return collected[:max_count]

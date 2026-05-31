import re
import os
import time
import random
from selenium.webdriver.common.by import By
from selenium.common.exceptions import InvalidSessionIdException, WebDriverException
from constants import (
    MOBILE_BLOG_URL, MOBILE_POST_LINKS, LIKE_BUTTON,
    NAVER_SEARCH_BLOG_URL
)
from browser.human_actions import human_click, human_scroll
from config import BETWEEN_LIKES, SCROLL_COUNT
from utils.delays import (
    is_stop_requested, sleep_interruptible, wait_short, wait_medium, random_delay,
)
from utils.logger import get_logger
from paths import DEBUG_DIR as _DEBUG_DIR

logger = get_logger(__name__)

DEBUG_DIR = str(_DEBUG_DIR)


def _save_debug(driver, step_name):
    """디버그용: 현재 페이지 HTML을 파일로 저장"""
    try:
        os.makedirs(DEBUG_DIR, exist_ok=True)
        fname = f"like_{step_name}.html"
        path = os.path.join(DEBUG_DIR, fname)
        with open(path, "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        logger.info(f"[디버그] HTML 저장: {fname} (URL: {driver.current_url})")
    except Exception as e:
        logger.info(f"[디버그] HTML 저장 실패: {e}")


def collect_neighbor_posts(driver, scroll_count=None, stop_event=None):
    """이웃 새글 목록에서 포스팅 URL 수집"""
    if scroll_count is None:
        scroll_count = SCROLL_COUNT

    if is_stop_requested(stop_event):
        return []

    logger.info("이웃 포스팅 목록 수집 중...")
    driver.get(MOBILE_BLOG_URL)
    if not wait_medium(stop_event=stop_event):
        return []

    # 스크롤하며 포스팅 로드
    for _ in range(scroll_count):
        if is_stop_requested(stop_event):
            return []
        human_scroll(driver, random.randint(500, 1000))
        if not wait_short(stop_event=stop_event):
            return []

    _save_debug(driver, "neighbor_feed")

    # 링크 수집 — 여러 셀렉터 시도
    href_list = []

    # 방법 1: 기존 셀렉터
    elements = driver.find_elements(By.CSS_SELECTOR, MOBILE_POST_LINKS)
    for el in elements:
        href = el.get_attribute("href")
        if href and href not in href_list:
            href_list.append(href)

    # 방법 2: m.blog.naver.com 포스팅 링크 패턴
    if not href_list:
        logger.info("기존 셀렉터 실패, 대체 셀렉터 시도...")
        for selector in [
            "a[href*='m.blog.naver.com'][href*='/']",
            "a[class*='link']",
            ".feed_list a",
            ".list_feed a",
            "a[href*='blog.naver.com']",
        ]:
            try:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                for el in elements:
                    href = el.get_attribute("href") or ""
                    if "blog.naver.com" in href and re.search(r'/\d+$', href) and href not in href_list:
                        href_list.append(href)
                if href_list:
                    logger.info(f"대체 셀렉터 성공: '{selector}' → {len(href_list)}개")
                    break
            except Exception:
                continue

    logger.info(f"포스팅 {len(href_list)}개 수집 완료")
    return href_list


def _to_mobile_url(url):
    """PC 블로그 URL → 모바일 URL 변환"""
    return re.sub(r'https?://blog\.naver\.com', 'https://m.blog.naver.com', url)


def _to_pc_url(url):
    """모바일 블로그 URL → PC URL 변환"""
    return re.sub(r'https?://m\.blog\.naver\.com', 'https://blog.naver.com', url)


# 공감 버튼 셀렉터 후보 (PC mainFrame 기준)
_LIKE_SELECTORS = [
    "a.u_likeit_list_btn._button.off",   # 미공감 상태
    "a.u_likeit_list_btn",               # 공감/미공감 공통
    "a.u_likeit_button._face",           # 구버전 호환
    ".u_likeit_wrap a",
]


def collect_search_posts(driver, keyword, max_results=20, stop_event=None):
    """키워드 검색으로 블로그 포스팅 URL 수집

    네이버 블로그 검색 → 결과에서 포스팅 URL 추출 → 모바일 URL로 변환
    """
    if is_stop_requested(stop_event):
        return []

    logger.info(f"키워드 '{keyword}' 블로그 포스팅 검색 중...")
    url = NAVER_SEARCH_BLOG_URL + keyword
    driver.get(url)
    if not wait_medium(stop_event=stop_event):
        return []

    # 스크롤하여 더 많은 결과 로드
    for _ in range(3):
        if is_stop_requested(stop_event):
            return []
        human_scroll(driver, random.randint(500, 900))
        if not wait_short(stop_event=stop_event):
            return []

    # page_source 정규식으로 포스팅 URL 추출 (CSS 셀렉터는 네이버 HTML 변경 시 깨짐)
    href_list = []
    for _ in range(3):
        if is_stop_requested(stop_event):
            return href_list
        human_scroll(driver, random.randint(500, 900))
        if not wait_short(stop_event=stop_event):
            return href_list
        for path in re.findall(r'blog\.naver\.com/([a-zA-Z0-9_]+/\d+)', driver.page_source):
            url = _to_mobile_url(f"https://blog.naver.com/{path}")
            if url not in href_list:
                href_list.append(url)
        if len(href_list) >= max_results:
            break

    href_list = href_list[:max_results]
    logger.info(f"키워드 '{keyword}'에서 포스팅 {len(href_list)}개 수집")
    return href_list


_like_debug_saved = False


def like_post(driver, url, stop_event=None):
    """포스팅 방문 후 공감 클릭 (PC URL + mainFrame iframe 방식)"""
    global _like_debug_saved
    try:
        if is_stop_requested(stop_event):
            return None

        # 항상 PC URL로 변환 (모바일은 셀렉터가 달라서 불안정)
        pc_url = _to_pc_url(url)
        driver.get(pc_url)
        if not wait_medium(stop_event=stop_event):
            return None

        # mainFrame iframe 진입
        try:
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            WebDriverWait(driver, 10).until(
                EC.frame_to_be_available_and_switch_to_it("mainFrame")
            )
        except Exception:
            pass  # mainFrame 없으면 직접 접근 시도

        # 첫 번째 포스트에서 디버그 HTML 저장
        if not _like_debug_saved:
            _save_debug(driver, "post_page")
            _like_debug_saved = True

        # 공감 버튼 — 다중 셀렉터 시도
        like_btn = None
        for sel in _LIKE_SELECTORS:
            try:
                els = driver.find_elements(By.CSS_SELECTOR, sel)
                if els:
                    like_btn = els[0]
                    break
            except Exception:
                continue

        if not like_btn:
            logger.warning(f"공감 버튼 못 찾음: {url[:60]}...")
            driver.switch_to.default_content()
            return False

        # 이미 공감했는지 확인
        aria = like_btn.get_attribute("aria-pressed")
        classes = (like_btn.get_attribute("class") or "").split()
        if aria == "true" or "on" in classes:
            logger.info(f"이미 공감함 (건너뜀): {url[:60]}...")
            driver.switch_to.default_content()
            return False

        try:
            human_click(driver, like_btn)
        except Exception:
            driver.execute_script("arguments[0].click();", like_btn)
        if not wait_short(stop_event=stop_event):
            return None
        driver.switch_to.default_content()
        logger.info(f"공감 완료: {url[:60]}...")
        return True
    except (InvalidSessionIdException, WebDriverException) as e:
        if not is_stop_requested(stop_event):
            logger.warning(f"공감 실패: {url[:60]}... - {e}")
        try:
            driver.switch_to.default_content()
        except Exception:
            pass
        return None if is_stop_requested(stop_event) else False
    except Exception as e:
        if not is_stop_requested(stop_event):
            logger.warning(f"공감 실패: {url[:60]}... - {e}")
        try:
            driver.switch_to.default_content()
        except Exception:
            pass
        return None if is_stop_requested(stop_event) else False


def auto_like(driver, max_posts=20, mode="neighbor", keyword=None, stop_event=None):
    """자동 공감

    Args:
        mode: "neighbor" (이웃 새글) 또는 "search" (키워드 검색)
        keyword: mode="search"일 때 검색 키워드
    """
    if mode == "search" and keyword:
        logger.info(f"자동 공감 시작 - 키워드 검색: '{keyword}' (최대 {max_posts}개)")
        urls = collect_search_posts(driver, keyword, max_results=max_posts * 2, stop_event=stop_event)
    else:
        logger.info(f"자동 공감 시작 - 이웃 새글 (최대 {max_posts}개)")
        urls = collect_neighbor_posts(driver, stop_event=stop_event)

    liked = 0

    for url in urls[:max_posts]:
        if is_stop_requested(stop_event):
            break

        result = like_post(driver, url, stop_event=stop_event)
        if result is None and is_stop_requested(stop_event):
            break
        if result:
            liked += 1
        if not sleep_interruptible(
            random_delay(BETWEEN_LIKES, 0.5, 1.0, 4.0),
            stop_event=stop_event,
        ):
            break

    if is_stop_requested(stop_event):
        logger.info(f"자동 공감 중지: {liked}/{min(len(urls), max_posts)}개 성공")
    else:
        logger.info(f"자동 공감 완료: {liked}/{min(len(urls), max_posts)}개 성공")
    return liked

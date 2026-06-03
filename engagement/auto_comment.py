import time
import re
import os
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from constants import POST_BODY, COMMENT_INPUT, COMMENT_UPLOAD
from browser.human_actions import human_click, human_scroll
from google import genai
from engagement.auto_like import collect_neighbor_posts, collect_search_posts
from config import BETWEEN_COMMENTS, TEST_CBOX_POST_URL
from utils.delays import (
    is_stop_requested, sleep_interruptible, wait_short, wait_medium, random_delay,
)
from utils.logger import get_logger
from paths import DEBUG_DIR as _DEBUG_DIR
import random

logger = get_logger(__name__)

DEBUG_DIR = str(_DEBUG_DIR)

# 댓글 톤 프리셋
COMMENT_TONES = {
    "friendly": "자연스럽고 친근한 톤으로",
    "professional": "전문적이고 정중한 톤으로",
    "casual": "가볍고 편한 말투로 (반말 OK)",
    "enthusiastic": "열정적이고 감탄하는 톤으로",
}


def _save_comment_debug(driver, step_name):
    """디버그용: 현재 페이지 HTML을 파일로 저장"""
    try:
        os.makedirs(DEBUG_DIR, exist_ok=True)
        fname = f"comment_{step_name}.html"
        path = os.path.join(DEBUG_DIR, fname)
        with open(path, "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        logger.info(f"[디버그] 댓글 HTML 저장: {fname}")
    except Exception as e:
        logger.debug(f"[디버그] HTML 저장 실패: {e}")


def _to_pc_url(url):
    """모바일 블로그 URL → PC URL 변환"""
    return re.sub(r'https?://m\.blog\.naver\.com', 'https://blog.naver.com', url)


def _log_cookie_domains(driver):
    """현재 브라우저의 쿠키 도메인 목록을 로그로 출력 (디버그용)"""
    try:
        cookies = driver.get_cookies()
        domains = set(c.get('domain', '?') for c in cookies)
        nid_cookies = [c['name'] for c in cookies
                       if c.get('name', '').startswith('NID')]
        logger.info(f"[디버그] 쿠키 도메인: {domains}")
        logger.info(f"[디버그] NID 쿠키: {nid_cookies}")
    except Exception as e:
        logger.debug(f"[디버그] 쿠키 조회 실패: {e}")


def _log_cbox_info(driver):
    """cbox 스크립트 URL 및 관련 정보를 로그로 출력 (디버그용)

    cbox는 별도 iframe이 아니라 mainFrame 안에 인라인으로 렌더됩니다.
    JS는 apis.naver.com/commentBox/cbox9 에서 로드되며,
    이 JS가 .naver.com 쿠키를 기반으로 로그인 상태를 판단합니다.
    """
    try:
        # cbox API URL 추출
        cbox_url = driver.execute_script("""
            return (typeof naverCommentApiURL !== 'undefined')
                ? naverCommentApiURL : null;
        """)
        if cbox_url:
            logger.info(f"[디버그] cbox API URL: {cbox_url}")
        else:
            logger.info("[디버그] cbox API URL 변수 없음 (naverCommentApiURL)")

        # cbox 스크립트 src 추출
        scripts = driver.execute_script("""
            var scripts = document.querySelectorAll('script[src*="commentBox"]');
            return Array.from(scripts).map(s => s.src);
        """)
        for src in (scripts or []):
            logger.info(f"[디버그] cbox script src: {src}")

        # cbox가 iframe인지 인라인인지 확인
        cbox_iframes = driver.execute_script("""
            var iframes = document.querySelectorAll('iframe[src*="comment"], iframe[src*="cbox"]');
            return Array.from(iframes).map(f => ({id: f.id, src: f.src, name: f.name}));
        """)
        if cbox_iframes:
            for ifr in cbox_iframes:
                logger.info(f"[디버그] cbox iframe: id={ifr.get('id')}, src={ifr.get('src','')[:100]}")
        else:
            logger.info("[디버그] cbox는 iframe 아님 (mainFrame 인라인)")

    except Exception as e:
        logger.debug(f"[디버그] cbox 정보 추출 실패: {e}")


def handle_possible_alert(driver, context="unknown", stop_event=None):
    """브라우저 alert 팝업이 떠 있으면 로그 남기고 닫기

    네이버 블로그 페이지 이동 시 "게시물이 삭제되었거나 다른 페이지로
    변경되었습니다" 등의 JS alert가 발생할 수 있음.
    처리하지 않으면 Selenium이 UnexpectedAlertPresentException 으로 죽음.
    """
    try:
        alert = driver.switch_to.alert
        alert_text = alert.text
        logger.warning(f"[{context}] alert 발생: {alert_text}")
        alert.accept()
        sleep_interruptible(0.5, stop_event=stop_event)
        return True  # alert가 있었고 처리했음
    except Exception:
        return False  # alert 없음


def _find_test_post(driver, naver_id, stop_event=None):
    """cbox 테스트용 포스트 URL 확보

    우선순위:
    1. config.yaml의 TEST_CBOX_POST_URL (직접 지정)
    2. 모바일 블로그(m.blog.naver.com/{naver_id})에서 첫 포스트 추출 → PC URL 변환
    """
    # --- 1순위: 설정값 ---
    if TEST_CBOX_POST_URL:
        logger.info(f"[디버그] TEST_CBOX_POST_URL 사용: {TEST_CBOX_POST_URL}")
        return TEST_CBOX_POST_URL

    if not naver_id:
        logger.warning("[실패] naver_id 없음 — 테스트 포스트 탐색 불가")
        return None

    # --- 2순위: 모바일 블로그에서 포스트 링크 추출 ---
    logger.info(f"[디버그] 테스트 포스트 자동 탐색 fallback 사용 (m.blog.naver.com/{naver_id})")
    try:
        if is_stop_requested(stop_event):
            return None
        driver.get(f"https://m.blog.naver.com/{naver_id}")
        if not sleep_interruptible(2, stop_event=stop_event):
            return None
        handle_possible_alert(driver, context="find_test_post", stop_event=stop_event)

        # 모바일 블로그 메인에서 포스트 링크 찾기
        for sel in [
            f"a[href*='m.blog.naver.com/{naver_id}/']",
            f"a[href*='/{naver_id}/']",
            "a.link__iGhdO",
            "a[class*='link']",
        ]:
            try:
                links = driver.find_elements(By.CSS_SELECTOR, sel)
                for link in links:
                    href = link.get_attribute("href") or ""
                    # /naver_id/숫자 패턴 (포스트 URL)
                    if re.search(rf'/{naver_id}/\d{{10,}}', href):
                        pc_url = _to_pc_url(href)
                        logger.info(f"테스트 포스트 발견: {pc_url[:80]}")
                        return pc_url
            except Exception:
                continue

        handle_possible_alert(driver, context="find_test_post_after_search", stop_event=stop_event)
        logger.warning("[실패] 개인 블로그에서 테스트 포스트 URL 확보 실패")
    except Exception as e:
        handle_possible_alert(driver, context="find_test_post_exception", stop_event=stop_event)
        if not is_stop_requested(stop_event):
            logger.warning(f"[실패] 테스트 포스트 탐색 실패: {e}")
        try:
            driver.switch_to.default_content()
        except Exception:
            pass

    # --- 3순위: 로그인된 이웃 새글 피드에서 첫 포스트 사용 ---
    try:
        logger.info("[fallback] 이웃 새글 피드에서 테스트 포스트 탐색")
        urls = collect_neighbor_posts(driver, scroll_count=1, stop_event=stop_event)
        if urls:
            pc_url = _to_pc_url(urls[0])
            logger.info(f"[fallback] 이웃 새글 포스트 발견: {pc_url[:80]}")
            return pc_url
        logger.warning("[fallback] 이웃 새글 피드에서도 포스트 못 찾음")
    except Exception as e:
        if not is_stop_requested(stop_event):
            logger.warning(f"[fallback] 이웃 새글 포스트 탐색 실패: {e}")

    return None


def _find_test_post_fallback(driver, naver_id, stop_event=None):
    """모바일 블로그에서 테스트 포스트 URL 확보 (config URL 실패 시 fallback)"""
    if not naver_id:
        return None
    logger.info(f"[fallback] 모바일 블로그에서 테스트 포스트 탐색: m.blog.naver.com/{naver_id}")
    try:
        if is_stop_requested(stop_event):
            return None
        driver.get(f"https://m.blog.naver.com/{naver_id}")
        if not sleep_interruptible(2, stop_event=stop_event):
            return None
        handle_possible_alert(driver, context="find_test_post_fallback", stop_event=stop_event)
        for sel in [
            f"a[href*='m.blog.naver.com/{naver_id}/']",
            f"a[href*='/{naver_id}/']",
            "a.link__iGhdO",
            "a[class*='link']",
        ]:
            try:
                links = driver.find_elements(By.CSS_SELECTOR, sel)
                for link in links:
                    href = link.get_attribute("href") or ""
                    if re.search(rf'/{naver_id}/\d{{10,}}', href):
                        pc_url = _to_pc_url(href)
                        logger.info(f"[fallback] 테스트 포스트 발견: {pc_url[:80]}")
                        return pc_url
            except Exception:
                continue
        logger.warning("[fallback] 모바일 블로그에서도 포스트 못 찾음")
    except Exception as e:
        handle_possible_alert(driver, context="find_test_post_fallback_err", stop_event=stop_event)
        if not is_stop_requested(stop_event):
            logger.warning(f"[fallback] 테스트 포스트 탐색 실패: {e}")
    return None


def _try_load_post_for_cbox(driver, test_url, stop_event=None):
    """테스트 포스트 접속 → mainFrame 전환 시도

    Returns:
        True: mainFrame 전환 성공 (cbox 확인 가능)
        False: alert(삭제 글) 또는 mainFrame 전환 실패
    """
    logger.info(f"cbox 테스트: {test_url[:70]}...")
    driver.get(test_url)
    if not sleep_interruptible(3, stop_event=stop_event):
        return False
    got_alert = handle_possible_alert(driver, context="ensure_cbox_post_load", stop_event=stop_event)
    if got_alert:
        logger.warning(f"포스트 삭제/이동됨 (alert): {test_url[:60]}")
        return False

    driver.switch_to.default_content()
    try:
        WebDriverWait(driver, 10).until(
            EC.frame_to_be_available_and_switch_to_it("mainFrame")
        )
        return True
    except Exception:
        handle_possible_alert(driver, context="ensure_cbox_mainframe", stop_event=stop_event)
        if not is_stop_requested(stop_event):
            logger.warning("cbox 테스트: mainFrame 전환 실패")
        return False


def ensure_cbox_logged_in(driver, naver_id=None, stop_event=None):
    """cbox 기준 로그인 상태를 실제 블로그 포스트에서 확인

    blog.naver.com 상단 GNB가 '로그인됨'을 표시해도,
    cbox(댓글 컴포넌트)는 별도 API(apis.naver.com/commentBox/cbox9)로
    로그인 상태를 확인하기 때문에 cbox만 로그아웃일 수 있습니다.

    이 함수는 실제 블로그 포스트를 열어 cbox가 로그인 상태로
    렌더되는지 확인합니다. config URL이 삭제된 글이면 모바일 블로그
    fallback을 자동으로 시도합니다.

    Returns:
        True: cbox 로그인 확인됨 (댓글 작성 가능)
        False: cbox 로그아웃 상태 또는 확인 불가
    """
    try:
        if is_stop_requested(stop_event):
            return False
        logger.info("=== cbox 로그인 상태 확인 시작 ===")
        driver.switch_to.default_content()
        _log_cookie_domains(driver)

        # --- 테스트 포스트 URL 확보 ---
        test_url = _find_test_post(driver, naver_id, stop_event=stop_event)
        if not test_url:
            if not is_stop_requested(stop_event):
                logger.warning("[실패] 테스트 포스트 URL 확보 실패 — cbox 확인 불가")
            return False

        # --- 포스트 접속 + mainFrame 전환 ---
        if not _try_load_post_for_cbox(driver, test_url, stop_event=stop_event):
            # config URL이 삭제된 글 → 모바일 블로그 fallback
            if TEST_CBOX_POST_URL and test_url == TEST_CBOX_POST_URL:
                logger.info("config URL 실패 — 모바일 블로그 fallback 시도")
                fallback_url = _find_test_post_fallback(driver, naver_id, stop_event=stop_event)
                if fallback_url and _try_load_post_for_cbox(driver, fallback_url, stop_event=stop_event):
                    pass  # fallback 성공, 아래 cbox 확인으로 진행
                else:
                    if not is_stop_requested(stop_event):
                        logger.warning("[실패] fallback 포스트도 실패 — cbox 확인 불가")
                    return False
            else:
                return False

        # --- 댓글 토글 버튼 클릭 ---
        comment_toggle = None
        for sel in [
            "a.btn_comment._cmtList",
            "a[id^='Comi']",
            ".area_comment a.btn_comment",
        ]:
            try:
                comment_toggle = driver.find_element(By.CSS_SELECTOR, sel)
                if comment_toggle:
                    break
            except Exception:
                continue

        if comment_toggle:
            driver.execute_script(
                "arguments[0].scrollIntoView({block:'center'});", comment_toggle)
            if not sleep_interruptible(0.5, stop_event=stop_event):
                return False
            driver.execute_script("arguments[0].click();", comment_toggle)
            logger.info("cbox 테스트: 댓글 토글 버튼 클릭")
            if not sleep_interruptible(2, stop_event=stop_event):
                return False
        else:
            logger.warning("cbox 테스트: 댓글 토글 버튼 못 찾음 (댓글 비허용 글?)")

        # --- 댓글쓰기 버튼 클릭 ---
        try:
            write_btn = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR,
                    "a.btn_write_comment._naverCommentWriteBtn"))
            )
            driver.execute_script("arguments[0].click();", write_btn)
            logger.info("cbox 테스트: 댓글쓰기 버튼 클릭")
            if not sleep_interruptible(2, stop_event=stop_event):
                return False
        except Exception:
            logger.info("cbox 테스트: 댓글쓰기 버튼 없음, cbox 직접 대기")

        # --- cbox 로드 대기 ---
        try:
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR,
                    ".u_cbox_write_wrap, .u_cbox_inbox, .u_cbox_comment"))
            )
            logger.info("cbox 테스트: cbox 로드 완료")
        except Exception:
            logger.warning("cbox 테스트: cbox 로드 실패")
            _save_comment_debug(driver, "cbox_test_no_cbox")
            driver.switch_to.default_content()
            return False

        # --- cbox 디버그 정보 ---
        _log_cbox_info(driver)

        # --- 로그인 상태 판별 ---
        html = driver.page_source

        if "u_cbox_type_logged_out" in html:
            logger.warning("[실패] cbox 기준 로그아웃 상태 — 댓글 불가")
            _save_comment_debug(driver, "cbox_test_logged_out")
            driver.switch_to.default_content()
            _log_cookie_domains(driver)
            return False

        if "u_cbox_type_logged_in" in html or "u_cbox_write_area" in html:
            logger.info("[성공] cbox 기준 로그인 확인 — 댓글 가능")
            _save_comment_debug(driver, "cbox_test_logged_in")
            driver.switch_to.default_content()
            return True

        # 판별 불가
        logger.warning("cbox 로그인 상태 판별 불가 — 디버그 HTML 저장")
        _save_comment_debug(driver, "cbox_test_unknown")
        driver.switch_to.default_content()
        return False

    except Exception as e:
        handle_possible_alert(driver, context="ensure_cbox_exception", stop_event=stop_event)
        if not is_stop_requested(stop_event):
            logger.warning(f"cbox 로그인 확인 실패: {e}")
        try:
            driver.switch_to.default_content()
        except Exception:
            pass
        return False


def generate_comment(body_text, api_key, tone="friendly", custom_instruction=None, model="gemini-3.1-pro-preview"):
    """포스팅 본문을 읽고 AI로 맞춤 댓글 생성 (Claude / Gemini 선택 가능)"""
    if custom_instruction:
        tone_guide = custom_instruction
    else:
        tone_guide = COMMENT_TONES.get(tone, COMMENT_TONES["friendly"])

    prompt = f"""다음 블로그 글을 읽고 공감하는 짧은 댓글을 작성해주세요.
{tone_guide}, 2-3문장으로 작성하세요.
이모티콘이나 이모지는 사용하지 마세요.
너무 과장하거나 광고처럼 보이지 않게 자연스럽게 써주세요.

글 내용:
{body_text[:1000]}"""

    if model == "claude":
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model="claude-haiku-4-5",
                max_tokens=300,
                messages=[{"role": "user", "content": prompt}],
            )
            if response and response.content:
                return response.content[0].text.strip()
        except Exception as e:
            logger.error(f"Claude 댓글 생성 오류: {e}")
        return None

    try:
        client = genai.Client(api_key=api_key)
        gemini_model_id = model if model.startswith("gemini-") else "gemini-3.1-pro-preview"
        response = client.models.generate_content(
            model=gemini_model_id, contents=prompt
        )
        if response and response.text:
            return response.text.strip()
    except Exception as e:
        logger.error(f"Gemini 댓글 생성 오류: {e}")
    return None


_comment_debug_count = 0


def post_comment(driver, url, api_key, tone="friendly", custom_instruction=None,
                 ai_model="gemini-3.1-pro-preview", stop_event=None):
    """포스팅 방문 → 본문 읽기 → AI 댓글 생성 → 댓글 작성

    PC 블로그(blog.naver.com) + mainFrame + cbox 인라인 구조 사용.
    cbox 로그인 확인은 ensure_cbox_logged_in()에서 사전 검증 완료된 상태.
    """
    global _comment_debug_count
    try:
        if is_stop_requested(stop_event):
            return None

        # === 1. PC URL로 변환 후 접속 ===
        pc_url = _to_pc_url(url)
        logger.info(f"PC 블로그 접속: {pc_url[:70]}...")
        driver.get(pc_url)
        if not wait_medium(stop_event=stop_event):
            return None

        # === 2. mainFrame 전환 ===
        driver.switch_to.default_content()
        try:
            WebDriverWait(driver, 10).until(
                EC.frame_to_be_available_and_switch_to_it("mainFrame")
            )
        except Exception:
            logger.warning(f"mainFrame 전환 실패: {url[:60]}...")
            if _comment_debug_count == 0:
                _save_comment_debug(driver, "01_no_mainframe")
                _comment_debug_count += 1
            return False

        if _comment_debug_count == 0:
            _save_comment_debug(driver, "01_mainframe")

        # === 3. 본문 텍스트 추출 ===
        body_text = ""
        for selector in [POST_BODY, ".se-main-container", ".post_ct",
                         "#postViewArea", "article", ".se-viewer"]:
            try:
                body_text = driver.find_element(By.CSS_SELECTOR, selector).text
                if body_text.strip():
                    break
            except Exception:
                continue

        if not body_text.strip():
            logger.warning(f"본문 추출 실패: {url[:60]}...")
            driver.switch_to.default_content()
            return False

        # === 4. 댓글 토글 버튼 클릭 (댓글 영역 열기) ===
        comment_toggle = None
        for sel in [
            "a.btn_comment._cmtList",
            "a[id^='Comi']",
            ".area_comment a.btn_comment",
        ]:
            try:
                comment_toggle = driver.find_element(By.CSS_SELECTOR, sel)
                if comment_toggle:
                    break
            except Exception:
                continue

        if not comment_toggle:
            logger.warning(f"댓글 토글 버튼 못 찾음: {url[:60]}...")
            driver.switch_to.default_content()
            return False

        driver.execute_script(
            "arguments[0].scrollIntoView({block: 'center'});", comment_toggle)
        if not sleep_interruptible(0.5, stop_event=stop_event):
            return None
        driver.execute_script("arguments[0].click();", comment_toggle)
        logger.info("댓글 토글 버튼 클릭")
        if not sleep_interruptible(2, stop_event=stop_event):
            return None

        if _comment_debug_count == 0:
            _save_comment_debug(driver, "02_after_toggle")

        # === 5. cbox 댓글 영역 로드 대기 ===
        try:
            write_btn = WebDriverWait(driver, 8).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR,
                    "a.btn_write_comment._naverCommentWriteBtn"))
            )
            driver.execute_script("arguments[0].click();", write_btn)
            logger.info("댓글쓰기 버튼 클릭")
            if not sleep_interruptible(2, stop_event=stop_event):
                return None
        except Exception:
            logger.info("댓글쓰기 버튼 없음, cbox 직접 대기...")

        cbox_found = False
        try:
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR,
                    ".u_cbox_write_wrap, .u_cbox_inbox, .u_cbox_comment"))
            )
            cbox_found = True
            logger.info("cbox 입력 영역 로드 완료")
        except Exception:
            pass

        if not cbox_found:
            logger.warning(f"cbox 로드 실패: {url[:60]}...")
            if _comment_debug_count == 0:
                _save_comment_debug(driver, "03_cbox_not_found")
                _comment_debug_count += 1
            driver.switch_to.default_content()
            return False

        if _comment_debug_count == 0:
            _save_comment_debug(driver, "03_cbox_found")

        # === 6. 로그인 상태 확인 ===
        # ensure_cbox_logged_in()에서 사전 검증됨.
        # 개별 글에서도 혹시 로그아웃이면 즉시 중단 (전체 루프 중단용).
        if driver.find_elements(By.CSS_SELECTOR, ".u_cbox_type_logged_out"):
            logger.warning(f"cbox 로그아웃 — 이 글 건너뜀: {url[:60]}...")
            _save_comment_debug(driver, "04_cbox_logged_out")
            # cbox 관련 디버그 정보
            _log_cbox_info(driver)
            driver.switch_to.default_content()
            _log_cookie_domains(driver)
            return False

        # === 7. AI 댓글 생성 ===
        comment = generate_comment(body_text, api_key, tone=tone,
                                   custom_instruction=custom_instruction, model=ai_model)
        if not comment:
            logger.warning("댓글 생성 실패")
            driver.switch_to.default_content()
            return False

        logger.info(f"댓글 생성 완료 ({len(comment)}자)")

        # === 8. 댓글 입력란 찾기 + 클릭 활성화 ===
        textarea = None
        for sel in [
            COMMENT_INPUT,
            ".u_cbox_inbox",
            "#naverComment__write_textarea",
            ".u_cbox_text[contenteditable='true']",
            "textarea.u_cbox_comment",
        ]:
            try:
                textarea = driver.find_element(By.CSS_SELECTOR, sel)
                if textarea:
                    break
            except Exception:
                continue

        if not textarea:
            logger.warning(f"댓글 입력란 못 찾음: {url[:60]}...")
            if _comment_debug_count == 0:
                _save_comment_debug(driver, "04_no_textarea")
                _comment_debug_count += 1
            driver.switch_to.default_content()
            return False

        driver.execute_script(
            "arguments[0].scrollIntoView({block: 'center'});", textarea)
        if not sleep_interruptible(0.5, stop_event=stop_event):
            return None
        driver.execute_script("arguments[0].click(); arguments[0].focus();", textarea)
        if not sleep_interruptible(1, stop_event=stop_event):
            return None

        # 클릭 후 실제 textarea가 활성화되었을 수 있음
        actual_input = None
        for sel in [
            "textarea.u_cbox_comment",
            ".u_cbox_text[contenteditable='true']",
            "#naverComment__write_textarea",
        ]:
            try:
                el = driver.find_element(By.CSS_SELECTOR, sel)
                if el.is_displayed():
                    actual_input = el
                    break
            except Exception:
                continue

        if actual_input:
            textarea = actual_input

        # === 9. 댓글 텍스트 입력 ===
        tag = textarea.tag_name.lower()
        try:
            if tag in ("textarea", "input"):
                textarea.clear()
                textarea.send_keys(comment)
            else:
                # contenteditable div — JS로 입력
                driver.execute_script("""
                    var el = arguments[0];
                    var text = arguments[1];
                    el.focus();
                    el.textContent = text;
                    el.dispatchEvent(new Event('input', {bubbles: true}));
                    el.dispatchEvent(new Event('change', {bubbles: true}));
                    el.dispatchEvent(new KeyboardEvent('keyup', {bubbles: true}));
                """, textarea, comment)
            if not wait_short(stop_event=stop_event):
                return None
        except Exception as e:
            if not is_stop_requested(stop_event):
                logger.warning(f"댓글 입력 실패: {url[:60]}... - {e}")
            driver.switch_to.default_content()
            return None if is_stop_requested(stop_event) else False

        # === 10. 등록 버튼 클릭 ===
        try:
            upload_btn = driver.find_element(By.CSS_SELECTOR, COMMENT_UPLOAD)
            driver.execute_script("arguments[0].click();", upload_btn)
            if not sleep_interruptible(1.5, stop_event=stop_event):
                return None
        except Exception:
            if not is_stop_requested(stop_event):
                logger.warning(f"댓글 등록 버튼 못 찾음: {url[:60]}...")
            if _comment_debug_count == 0:
                _save_comment_debug(driver, "05_no_submit_btn")
                _comment_debug_count += 1
            driver.switch_to.default_content()
            return None if is_stop_requested(stop_event) else False

        if _comment_debug_count == 0:
            _save_comment_debug(driver, "05_after_submit")
            _comment_debug_count += 1

        driver.switch_to.default_content()
        logger.info(f"댓글 작성 완료: {url[:60]}...")
        return True

    except Exception as e:
        if not is_stop_requested(stop_event):
            logger.warning(f"댓글 작성 실패: {url[:60]}... - {e}")
        try:
            driver.switch_to.default_content()
        except Exception:
            pass
        return None if is_stop_requested(stop_event) else False


def auto_comment(driver, api_key, max_posts=10, mode="neighbor", keyword=None,
                 tone="friendly", custom_instruction=None, naver_id=None,
                 ai_model="gemini-3.1-pro-preview", stop_event=None):
    """자동 댓글

    플로우:
    1. cbox 기준 로그인 확인 (ensure_cbox_logged_in)
       → 실패 시 이번 세션 댓글 전체 포기
    2. 이웃 새글/키워드 검색으로 URL 수집
    3. 각 URL에 대해 댓글 작성

    NOTE: blog.naver.com 로그인 동기화는 naver_login.py에서
    로그인 직후 sync_pc_blog_login()으로 이미 처리됨.
    """

    # === STEP 1: cbox 기준 로그인 확인 (실패 시 1회 재시도) ===
    if is_stop_requested(stop_event):
        return 0

    if not ensure_cbox_logged_in(driver, naver_id=naver_id, stop_event=stop_event):
        logger.info("cbox 로그인 재시도 중 (3초 대기)...")
        if not sleep_interruptible(3, stop_event=stop_event):
            return 0
        if not ensure_cbox_logged_in(driver, naver_id=naver_id, stop_event=stop_event):
            if not is_stop_requested(stop_event):
                logger.warning("cbox 로그인 확인 실패 — 이번 세션 댓글 기능 전체 건너뜀")
            return 0

    # === STEP 2: URL 수집 ===
    if mode == "search" and keyword:
        logger.info(f"자동 댓글 시작 - 키워드 검색: '{keyword}' (최대 {max_posts}개)")
        urls = collect_search_posts(driver, keyword, max_results=max_posts * 2, stop_event=stop_event)
    else:
        logger.info(f"자동 댓글 시작 - 이웃 새글 (최대 {max_posts}개)")
        urls = collect_neighbor_posts(driver, stop_event=stop_event)

    if not urls:
        logger.info("댓글 대상 포스트 없음")
        return 0

    # === STEP 3: 댓글 루프 ===
    commented = 0

    for url in urls[:max_posts]:
        if is_stop_requested(stop_event):
            break
        result = post_comment(
            driver, url, api_key, tone=tone,
            custom_instruction=custom_instruction, ai_model=ai_model,
            stop_event=stop_event,
        )
        if result:
            commented += 1
        else:
            if result is None and is_stop_requested(stop_event):
                break
            # cbox 로그아웃이 개별 글에서 다시 감지되면 루프 전체 중단
            # (세션이 끊겼을 가능성)
            if _check_cbox_still_logged_out(driver, url):
                logger.warning("cbox 로그아웃 재감지 — 댓글 루프 중단")
                break
        if not sleep_interruptible(
            random_delay(BETWEEN_COMMENTS, 0.8, 1.5, 5.0),
            stop_event=stop_event,
        ):
            break

    if is_stop_requested(stop_event):
        logger.info(f"자동 댓글 중지: {commented}/{min(len(urls), max_posts)}개 성공")
    else:
        logger.info(f"자동 댓글 완료: {commented}/{min(len(urls), max_posts)}개 성공")
    return commented


def _check_cbox_still_logged_out(driver, url):
    """직전 post_comment 실패가 cbox 로그아웃 때문인지 확인

    post_comment가 False를 반환한 경우, 다른 이유(본문 추출 실패 등)일 수 있음.
    cbox 로그아웃으로 인한 실패인 경우만 True 반환하여 루프 중단.
    """
    try:
        # 최근 저장된 디버그 HTML에서 확인
        for fname in ["comment_04_cbox_logged_out.html",
                       "comment_cbox_test_logged_out.html"]:
            path = os.path.join(DEBUG_DIR, fname)
            if os.path.exists(path):
                age = time.time() - os.path.getmtime(path)
                if age < 60:  # 1분 이내에 저장된 파일
                    return True
    except Exception:
        pass
    return False

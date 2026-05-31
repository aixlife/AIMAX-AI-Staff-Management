import time
import re
import random
import pyperclip
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import InvalidSessionIdException, WebDriverException
from constants import (
    NAVER_SEARCH_BLOG_URL, SEARCH_BLOG_LINKS, SEARCH_BLOG_USER,
    BLOG_HOME_URL, NEIGHBOR_MUTUAL_RADIO,
    NEIGHBOR_MSG_TEXTAREA, NEIGHBOR_SUBMIT_BTN, NEIGHBOR_CONFIRM_BTN,
    LOGIN_ID, LOGIN_PW, LOGIN_BUTTON
)
from browser.human_actions import human_click, human_scroll
from utils.delays import (
    is_stop_requested, sleep_interruptible, wait_short, wait_medium, random_delay,
)
from utils.logger import get_logger
from paths import DEBUG_DIR as _DEBUG_DIR
from auth.naver_login import login_on_current_nid_page
from engagement import neighbor_quota
import os

logger = get_logger(__name__)

# 속도 모드별 딜레이 프로파일 (avg, std, min, max) — 단위 초
# 근거: 네이버 2025-07 봇 탐지 강화, 공식 한도 100명/일.
# '보통'은 기존 값 유지, '안전'은 트래픽 분산 최적화, '빠름'은 과도한 가속 회피.
SPEED_PROFILES = {
    "safe": {
        "between_requests": (60.0, 15.0, 30.0, 90.0),   # 신청간 30~90초
        "between_keywords": (135.0, 25.0, 90.0, 180.0), # 키워드간 90~180초
        "label": "안전",
    },
    "normal": {
        "between_requests": (8.0, 2.0, 4.0, 15.0),
        "between_keywords": (15.0, 5.0, 8.0, 25.0),
        "label": "보통",
    },
    "fast": {
        "between_requests": (5.0, 1.5, 3.0, 8.0),
        "between_keywords": (10.0, 2.5, 5.0, 15.0),
        "label": "빠름",
    },
}

# Cool-down: N명마다 긴 휴식 (봇 탐지 회피)
COOLDOWN_RANGE = (60.0, 180.0)

# 멘트 치환 변수
_NICKNAME_PLACEHOLDERS = ("{닉네임}", "{nickname}")

DEBUG_DIR = str(_DEBUG_DIR)
_BLOCKED_NOTICE_PATTERNS = (
    "서로이웃 신청을 받지 않는 이웃입니다",
    "이미 이웃입니다",
    "이미 서로이웃입니다",
    "신청할 수 없습니다",
)
_STEP2_TEXTAREA_SELECTORS = [
    NEIGHBOR_MSG_TEXTAREA,
    "textarea",
    "textarea[name='message']",
]
_STEP_ACTION_BUTTON_SELECTORS = [
    "._buddyAddNext",
    "._buddyAddConfirm",
    ".button_next",
    ".button_confirm",
    ".area_button a:last-child",
    "button[type='submit']",
]


def _normalize_messages(message_or_list):
    """단일 문자열 또는 리스트를 [msg, ...] 형태로 정규화.

    - None → []
    - "멘트1\n멘트2" → ["멘트1", "멘트2"]
    - ["a", "b"] → ["a", "b"]
    빈 줄과 공백은 제거한다.
    """
    if message_or_list is None:
        return []
    if isinstance(message_or_list, str):
        raw = message_or_list.splitlines() if "\n" in message_or_list else [message_or_list]
    else:
        raw = list(message_or_list)
    return [m.strip() for m in raw if m and m.strip() and len(m.strip()) <= 400]


def _render_message(template: str, blog_id: str) -> str:
    """멘트 템플릿의 {닉네임} 변수를 blog_id로 치환.

    네이버 정식 닉네임은 서이추 폼에서 즉시 얻기 어려워 blog_id로 대체한다.
    (검색 결과 링크가 blog_id 기반이므로 수신자 식별 단서로 충분.)
    """
    if not template:
        return ""
    result = template
    for placeholder in _NICKNAME_PLACEHOLDERS:
        if placeholder in result:
            result = result.replace(placeholder, blog_id)
    return result


def _pick_message(messages, blog_id: str):
    """멘트 풀에서 랜덤 1개 선택 후 치환. 비어있으면 None."""
    if not messages:
        return None
    return _render_message(random.choice(messages), blog_id)


def _save_debug(driver, step_name, blog_id=""):
    """디버그용: 현재 페이지 HTML을 파일로 저장"""
    try:
        os.makedirs(DEBUG_DIR, exist_ok=True)
        fname = f"neighbor_{step_name}_{blog_id}.html"
        path = os.path.join(DEBUG_DIR, fname)
        with open(path, "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        logger.info(f"[디버그] HTML 저장: {fname} (URL: {driver.current_url})")
    except Exception as e:
        logger.info(f"[디버그] HTML 저장 실패: {e}")


def _normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _page_inner_text(driver) -> str:
    try:
        return _normalize_space(driver.execute_script(
            "return document.body ? (document.body.innerText || document.body.textContent || '') : '';"
        ))
    except Exception:
        return ""


def _analyze_neighbor_form_html(page_source: str) -> dict:
    """서로이웃 폼 HTML에서 신청 가능 여부를 정적으로 분석한다."""
    info = {
        "mutual_radio_present": False,
        "mutual_radio_disabled": False,
        "notice_text": "",
        "blocked_reason": None,
    }

    if not page_source:
        return info

    if re.search(r'id=["\']each_buddy_add["\']', page_source, re.I):
        info["mutual_radio_present"] = True

    if re.search(r'id=["\']each_buddy_add["\'][^>]*disabled', page_source, re.I | re.S):
        info["mutual_radio_disabled"] = True
        info["blocked_reason"] = "서로이웃 라디오 disabled"

    notice_match = re.search(
        r'<p[^>]*class=["\'][^"\']*notice[^"\']*["\'][^>]*>(.*?)</p>',
        page_source,
        re.I | re.S,
    )
    if notice_match:
        notice_text = _normalize_space(re.sub(r"<[^>]+>", " ", notice_match.group(1)))
        info["notice_text"] = notice_text
        if any(pattern in notice_text for pattern in _BLOCKED_NOTICE_PATTERNS):
            info["blocked_reason"] = notice_text

    return info


def _detect_neighbor_block_reason(driver):
    """현재 폼이 실제로 신청 불가 상태인지 판단한다."""
    try:
        analysis = _analyze_neighbor_form_html(driver.page_source)
        if analysis["blocked_reason"]:
            return analysis["blocked_reason"]

        for el in driver.find_elements(By.CSS_SELECTOR, ".notice, .error_area, .buddy_state .notice"):
            text = _normalize_space(el.text)
            if text and any(pattern in text for pattern in _BLOCKED_NOTICE_PATTERNS):
                return text

        body_text = _page_inner_text(driver)
        for pattern in _BLOCKED_NOTICE_PATTERNS:
            if pattern in body_text:
                return pattern
    except Exception:
        pass
    return None


def _find_first(driver, selectors):
    for sel in selectors:
        try:
            elements = driver.find_elements(By.CSS_SELECTOR, sel)
            for el in elements:
                if el:
                    return el, sel
        except Exception:
            continue
    return None, None


def _select_mutual_neighbor(driver, blog_id, stop_event=None):
    """서로이웃 라디오를 강제로 선택하고 실제 체크 여부를 검증한다."""
    try:
        radio = WebDriverWait(driver, 5).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "#each_buddy_add"))
        )
    except Exception:
        logger.warning(f"서로이웃 라디오 못 찾음: {blog_id}")
        return False

    if radio.get_attribute("disabled") is not None or not radio.is_enabled():
        logger.info(f"서로이웃 신청 불가 (라디오 disabled): {blog_id}")
        return False

    try:
        label = driver.find_element(By.CSS_SELECTOR, "label[for='each_buddy_add']")
        driver.execute_script("arguments[0].click();", label)
        if not wait_short(stop_event=stop_event):
            return False
    except Exception:
        pass

    try:
        checked = driver.execute_script("""
            const mutual = document.querySelector('#each_buddy_add');
            const buddy = document.querySelector('#buddy_add');
            if (!mutual || mutual.disabled) return false;

            mutual.checked = true;
            mutual.setAttribute('checked', 'checked');
            mutual.dispatchEvent(new Event('input', { bubbles: true }));
            mutual.dispatchEvent(new Event('change', { bubbles: true }));

            if (mutual.parentElement) mutual.parentElement.classList.add('checked');
            if (buddy) {
                buddy.checked = false;
                buddy.removeAttribute('checked');
                if (buddy.parentElement) buddy.parentElement.classList.remove('checked');
            }
            return !!mutual.checked;
        """)
    except Exception:
        checked = False

    if checked:
        logger.info(f"서로이웃 라디오 선택 완료: {blog_id}")
        return True

    logger.warning(f"서로이웃 라디오 선택 실패: {blog_id}")
    return False


def _wait_for_mutual_step2(driver, timeout=8):
    """2단계 멘트 입력 화면 진입 여부를 확인한다."""
    def _has_step2(_driver):
        for sel in _STEP2_TEXTAREA_SELECTORS:
            try:
                elements = _driver.find_elements(By.CSS_SELECTOR, sel)
                if any(el.is_displayed() for el in elements):
                    return True
            except Exception:
                continue
        return False

    try:
        WebDriverWait(driver, timeout).until(_has_step2)
        return True
    except Exception:
        return False


def _is_session_alive(driver):
    """드라이버 세션이 살아있는지 확인"""
    try:
        _ = driver.current_url
        return True
    except (InvalidSessionIdException, WebDriverException):
        return False


def _dismiss_alert(driver):
    """JavaScript alert 팝업이 있으면 닫기"""
    try:
        alert = driver.switch_to.alert
        alert_text = alert.text
        alert.accept()
        return alert_text
    except Exception:
        return None


_RESERVED_BLOG_IDS = {
    'PostView', 'PostList', 'GoBlogWrite', 'BuddyAddFormBridge',
    'BuddyAddForm', 'prologue', 'MyBlog', 'blogId', 'search',
    'login', 'logout', 'api', 'static', 'CommentList', 'TagList',
    'SympathyList', 'VisitBlog',
}

def extract_blog_id(url):
    """블로그 URL에서 블로거 ID 추출"""
    match = re.search(r'blog\.naver\.com/([a-zA-Z0-9_]+)', url)
    if match:
        blog_id = match.group(1)
        if blog_id not in _RESERVED_BLOG_IDS and len(blog_id) >= 4:
            return blog_id
    return None


def _extract_ids_from_source(page_source: str) -> list:
    """page_source 정규식으로 blog.naver.com/{id} 패턴 순서대로 추출.

    CSS 셀렉터 방식은 네이버 클래스명 변경 시 깨지므로 URL 패턴 기반으로 추출.
    검색결과 순서(등장 순)를 유지한다.
    """
    found = []
    for bid in re.findall(r'blog\.naver\.com/([a-zA-Z0-9_]{4,20})', page_source):
        if bid not in _RESERVED_BLOG_IDS and bid not in found:
            found.append(bid)
    return found


def search_bloggers(driver, keyword, max_results=20, stop_event=None):
    """네이버 블로그 검색 → 블로거 ID 수집 (검색결과 등장 순서 유지)"""
    if is_stop_requested(stop_event):
        return []

    logger.info(f"키워드 '{keyword}' 블로거 검색 중...")
    driver.get(NAVER_SEARCH_BLOG_URL + keyword)
    if not wait_medium(stop_event=stop_event):
        return []

    blog_ids = []

    # 스크롤하며 결과 누적 수집
    for scroll_n in range(4):
        if is_stop_requested(stop_event):
            return blog_ids
        ids = _extract_ids_from_source(driver.page_source)
        for bid in ids:
            if bid not in blog_ids:
                blog_ids.append(bid)

        if len(blog_ids) >= max_results:
            break

        human_scroll(driver, random.randint(600, 1000))
        if not wait_short(stop_event=stop_event):
            return blog_ids

    # 디버그: 첫 실행 시 검색결과 HTML 저장
    try:
        import os
        os.makedirs(DEBUG_DIR, exist_ok=True)
        safe_kw = re.sub(r'[^\w]', '_', keyword)
        with open(os.path.join(DEBUG_DIR, f"search_{safe_kw}.html"), "w", encoding="utf-8") as f:
            f.write(driver.page_source)
    except Exception:
        pass

    blog_ids = blog_ids[:max_results]
    logger.info(f"키워드 '{keyword}'에서 블로거 {len(blog_ids)}명 수집")
    return blog_ids



def _handle_nid_login_on_page(driver, naver_id, naver_pw):
    """NID 로그인 페이지에서 클립보드 로그인 수행

    BuddyAddFormBridge 등에서 NID 로그인 리다이렉트가 발생했을 때,
    해당 NID 페이지에서 직접 로그인하여 원래 목적지로 리다이렉트시킵니다.

    Returns:
        True: 로그인 성공 (NID 페이지에서 벗어남)
        False: 로그인 실패 또는 자격증명 없음
    """
    if "nidlogin" not in driver.current_url:
        return True  # NID 페이지가 아님

    if not naver_id or not naver_pw:
        logger.warning("NID 로그인 필요하나 자격증명 없음")
        return False

    try:
        return login_on_current_nid_page(driver, naver_id, naver_pw)
    except Exception as e:
        logger.warning(f"NID 페이지 로그인 실패: {e}")
        return False


def send_neighbor_request(driver, blog_id, message=None, naver_id=None, naver_pw=None, stop_event=None):
    """특정 블로거에게 서로이웃 신청

    BuddyAddFormBridge로 직접 이동 (블로그 홈 방문 + iframe 전환 단계 생략).
    NID 로그인 리다이렉트가 발생하면 해당 페이지에서 직접 로그인합니다.

    흐름: BuddyAddFormBridge 이동
          → (NID 로그인 필요 시 자동 처리)
          → [1단계] 서로이웃 라디오 → "다음" 클릭
          → [2단계] 멘트 입력 → "확인" 클릭
    """
    try:
        if is_stop_requested(stop_event):
            return None

        if not _is_session_alive(driver):
            logger.error("브라우저 세션이 끊어졌습니다")
            return None

        # ★ BuddyAddFormBridge 페이지로 직접 이동 (iframe 전환 불필요)
        form_url = f"https://blog.naver.com/BuddyAddFormBridge.naver?blogId={blog_id}"
        logger.info(f"서로이웃 신청 폼 이동: {blog_id}")
        driver.get(form_url)
        if not sleep_interruptible(2, stop_event=stop_event):
            return None

        _save_debug(driver, "04_form_page", blog_id)

        # NID 로그인 리다이렉트 → 해당 페이지에서 직접 로그인
        if "nidlogin" in driver.current_url:
            if not _handle_nid_login_on_page(driver, naver_id, naver_pw):
                logger.error(f"NID 로그인 실패로 서로이웃 신청 불가: {blog_id}")
                return None
            # 로그인 후 BuddyAddFormBridge로 재이동 (리다이렉트 대상이 다를 수 있음)
            if not sleep_interruptible(1, stop_event=stop_event):
                return None
            if "BuddyAdd" not in driver.current_url:
                driver.get(form_url)
                if not sleep_interruptible(2, stop_event=stop_event):
                    return None

        # alert 처리 (이미 이웃인 경우 등)
        alert_text = _dismiss_alert(driver)
        if alert_text:
            logger.info(f"알림 팝업: {alert_text} ({blog_id})")
            return False

        # 신청 불가 / 이미 이웃 체크 — page_source 전체 문자열이 아니라
        # 실제 notice/disabled 상태 위주로 판단해 오탐을 줄인다.
        blocked_reason = _detect_neighbor_block_reason(driver)
        if blocked_reason:
            logger.info(f"신청 불가 ({blocked_reason}): {blog_id}")
            return False

        # ── [1단계] 서로이웃 라디오 선택 → "다음" 버튼 ──
        if not _select_mutual_neighbor(driver, blog_id, stop_event=stop_event):
            _save_debug(driver, "05_step1_fail", blog_id)
            return False

        next_btn, next_sel = _find_first(driver, [NEIGHBOR_SUBMIT_BTN] + _STEP_ACTION_BUTTON_SELECTORS)
        if not next_btn:
            logger.warning(f"'다음' 버튼 못 찾음: {blog_id}")
            _save_debug(driver, "05_step1_fail", blog_id)
            return False

        try:
            driver.execute_script("arguments[0].click();", next_btn)
            if not wait_short(stop_event=stop_event):
                return None
            logger.info(f"'다음' 버튼 클릭 완료: {blog_id} ({next_sel})")
        except Exception:
            logger.warning(f"'다음' 버튼 클릭 실패: {blog_id}")
            _save_debug(driver, "05_step1_fail", blog_id)
            return False

        # alert 처리
        alert_text = _dismiss_alert(driver)
        if alert_text:
            logger.info(f"알림 팝업: {alert_text} ({blog_id})")
            return False

        # 2단계 폼 진입 대기 — 실패 시 한 번 더 form submit 시도
        step2_ready = _wait_for_mutual_step2(driver, timeout=6)
        if not step2_ready:
            try:
                force_submitted = driver.execute_script("""
                    const mutual = document.querySelector('#each_buddy_add');
                    const form = document.forms['buddyFrm'];
                    if (!mutual || !mutual.checked || !form) return false;
                    try {
                        if (window.blogUtil && form.token) form.token.value = blogUtil.getHashValue('token') || form.token.value;
                        if (window.blogUtil && form.origin) form.origin.value = blogUtil.getHashValue('origin') || form.origin.value;
                    } catch (e) {}
                    form.submit();
                    return true;
                """)
            except Exception:
                force_submitted = False

            if force_submitted:
                logger.info(f"2단계 폼 재시도 submit: {blog_id}")
                step2_ready = _wait_for_mutual_step2(driver, timeout=6)

        if not step2_ready:
            blocked_reason = _detect_neighbor_block_reason(driver)
            if blocked_reason:
                logger.info(f"신청 불가 ({blocked_reason}): {blog_id}")
            else:
                logger.warning(f"2단계 멘트 입력 화면 진입 실패: {blog_id}")
            _save_debug(driver, "05_step2_missing", blog_id)
            return False

        _save_debug(driver, "05_step2_page", blog_id)

        # ── [2단계] 멘트 입력 + "확인" 버튼 ──
        if message:
            try:
                textarea = None
                for sel in _STEP2_TEXTAREA_SELECTORS:
                    try:
                        textarea = WebDriverWait(driver, 3).until(
                            EC.presence_of_element_located((By.CSS_SELECTOR, sel))
                        )
                        if textarea:
                            break
                    except Exception:
                        continue
                if textarea is None:
                    raise Exception("textarea not found")
                textarea.clear()
                textarea.send_keys(message)
                if not wait_short(stop_event=stop_event):
                    return None
                logger.info(f"멘트 입력 완료: {blog_id}")
            except Exception:
                logger.info(f"멘트 입력란 못 찾음 (건너뜀): {blog_id}")

        # "확인" 버튼 클릭 (최종 제출)
        submit_btn, confirm_sel = _find_first(
            driver,
            [NEIGHBOR_CONFIRM_BTN, ".button_next", ".button_confirm", ".area_button a:last-child"]
        )
        if not submit_btn:
            logger.warning(f"'확인' 버튼 못 찾음, 신청 실패: {blog_id}")
            _save_debug(driver, "06_confirm_fail", blog_id)
            return False

        try:
            driver.execute_script("arguments[0].click();", submit_btn)
            if not wait_short(stop_event=stop_event):
                return None
            logger.info(f"'확인' 버튼 클릭 완료: {blog_id} ({confirm_sel})")
        except Exception:
            logger.warning(f"'확인' 버튼 못 찾음, 신청 실패: {blog_id}")
            _save_debug(driver, "06_confirm_fail", blog_id)
            return False

        # alert 처리 (신청 완료 알림 등)
        alert_text = _dismiss_alert(driver)
        if alert_text:
            logger.info(f"신청 결과 알림: {alert_text} ({blog_id})")

        logger.info(f"서로이웃 신청 완료: {blog_id}")
        return True

    except (InvalidSessionIdException, WebDriverException) as e:
        if not is_stop_requested(stop_event):
            logger.error(f"브라우저 세션 오류: {blog_id} - {type(e).__name__}")
        return None
    except Exception as e:
        if is_stop_requested(stop_event):
            return None
        logger.warning(f"서로이웃 신청 실패: {blog_id} - {e}")
        return False


def auto_neighbor(driver, keywords, max_per_keyword=10, message=None,
                  naver_id=None, naver_pw=None, stop_event=None,
                  messages=None, speed_mode="normal",
                  cooldown_every=10, daily_limit=50):
    """키워드 목록으로 서로이웃 자동 추가

    Args:
        driver: Selenium WebDriver
        keywords: 검색 키워드 리스트
        max_per_keyword: 키워드당 최대 서로이웃 신청 수
        message: (하위 호환) 단일 멘트. messages가 비어 있을 때만 사용.
        messages: 멘트 풀 (list[str] 또는 개행 구분 문자열). 매번 랜덤 선택.
                  '{닉네임}'이 있으면 블로그 ID로 치환.
        speed_mode: "safe" | "normal" | "fast" — SPEED_PROFILES 참조
        cooldown_every: N명마다 60~180초 Cool-down (0이면 비활성화)
        daily_limit: 하루 총 신청 상한 (AIMAX 권장 50명 이하. 0이면 무제한)
        naver_id: NID 로그인 리다이렉트 시 사용할 아이디. quota 집계 키로도 사용.
        naver_pw: NID 로그인 리다이렉트 시 사용할 비밀번호
    Returns:
        총 신청 성공 수
    """
    # 멘트 풀 정규화 — messages 우선, 없으면 message로 폴백
    msg_pool = _normalize_messages(messages)
    if not msg_pool and message:
        msg_pool = _normalize_messages(message)

    profile = SPEED_PROFILES.get(speed_mode, SPEED_PROFILES["normal"])
    req_delay = profile["between_requests"]
    kw_delay = profile["between_keywords"]

    # 일일 상한 체크
    today_count = neighbor_quota.get_today_count(naver_id)
    if daily_limit > 0:
        remaining_today = max(0, daily_limit - today_count)
        if remaining_today <= 0:
            logger.warning(
                f"오늘 이미 {today_count}명 신청(상한 {daily_limit}). 내일 다시 실행하세요."
            )
            return 0
        logger.info(
            f"일일 상한: {daily_limit}명 / 오늘 이미 {today_count}명 / 남은 가능 {remaining_today}명"
        )
    else:
        remaining_today = None  # 무제한

    logger.info(
        f"서로이웃 자동 추가 시작 "
        f"(키워드 {len(keywords)}개, 키워드당 최대 {max_per_keyword}명, "
        f"속도={profile['label']}, 멘트 {len(msg_pool)}종, "
        f"Cool-down={cooldown_every}명마다)"
    )

    total_sent = 0
    all_requested = set()
    should_stop = False

    for kw_idx, keyword in enumerate(keywords):
        keyword = keyword.strip()
        if not keyword:
            continue
        if is_stop_requested(stop_event) or should_stop:
            break

        if not _is_session_alive(driver):
            logger.error("브라우저 세션이 끊어져 서로이웃 추가를 중단합니다")
            break

        blog_ids = search_bloggers(driver, keyword, max_results=max_per_keyword * 2, stop_event=stop_event)
        sent_this_keyword = 0

        for blog_id in blog_ids:
            if is_stop_requested(stop_event):
                should_stop = True
                break
            if sent_this_keyword >= max_per_keyword:
                break
            if blog_id in all_requested:
                continue

            # 일일 상한 재확인
            if daily_limit > 0 and neighbor_quota.get_today_count(naver_id) >= daily_limit:
                logger.info(f"일일 상한 {daily_limit}명 도달. 작업을 중단합니다.")
                should_stop = True
                break

            all_requested.add(blog_id)

            # 멘트 랜덤 선택 (매번 다름)
            picked_message = _pick_message(msg_pool, blog_id)

            result = send_neighbor_request(
                driver, blog_id, message=picked_message,
                naver_id=naver_id, naver_pw=naver_pw, stop_event=stop_event,
            )
            if result is None:
                if not is_stop_requested(stop_event):
                    logger.error("세션이 끊어져 남은 블로거를 건너뜁니다")
                should_stop = True
                break
            elif result:
                total_sent += 1
                sent_this_keyword += 1
                new_count = neighbor_quota.increment(naver_id)

                # Cool-down: N명마다 긴 휴식
                if cooldown_every > 0 and new_count > 0 and new_count % cooldown_every == 0:
                    cool_secs = random.uniform(*COOLDOWN_RANGE)
                    logger.info(
                        f"Cool-down: {new_count}명 신청 → {cool_secs:.0f}초 휴식 "
                        f"(봇 탐지 회피)"
                    )
                    if not sleep_interruptible(cool_secs, stop_event=stop_event):
                        should_stop = True
                        break

            # 신청간 딜레이
            if not sleep_interruptible(
                random_delay(*req_delay),
                stop_event=stop_event,
            ):
                should_stop = True
                break

        logger.info(f"키워드 '{keyword}': {sent_this_keyword}명 신청 완료")

        # 키워드간 딜레이 (마지막 키워드 아니고 중단 요청 없을 때만)
        is_last_keyword = kw_idx == len(keywords) - 1
        if not is_last_keyword and not should_stop and not is_stop_requested(stop_event):
            if not sleep_interruptible(
                random_delay(*kw_delay),
                stop_event=stop_event,
            ):
                break

    final_today = neighbor_quota.get_today_count(naver_id)
    if is_stop_requested(stop_event):
        logger.info(
            f"서로이웃 자동 추가 중지: 이번 실행 {total_sent}명 / 오늘 누적 {final_today}명"
        )
    else:
        logger.info(
            f"서로이웃 자동 추가 완료: 이번 실행 {total_sent}명 / 오늘 누적 {final_today}명"
            + (f" / 일일 상한 {daily_limit}명" if daily_limit > 0 else "")
        )
    return total_sent


def _normalize_blog_id_list(blog_ids):
    """사용자가 준/크롤러가 수집한 blog_id 목록을 순서 유지하며 정리."""
    result = []
    seen = set()
    reserved = {blog_id.lower() for blog_id in _RESERVED_BLOG_IDS}
    for raw in blog_ids or []:
        blog_id = (raw or "").strip()
        if not re.fullmatch(r"[a-zA-Z0-9_]{4,30}", blog_id):
            continue
        blog_id_key = blog_id.lower()
        if blog_id_key in reserved or blog_id_key in seen:
            continue
        seen.add(blog_id_key)
        result.append(blog_id)
    return result


def auto_neighbor_to_blog_ids(driver, blog_ids, max_requests=10, message=None,
                              naver_id=None, naver_pw=None, stop_event=None,
                              messages=None, speed_mode="normal",
                              cooldown_every=10, daily_limit=50,
                              source_label="특정 블로거"):
    """이미 수집된 블로거 ID 목록에 서로이웃 신청.

    특정 블로거 링크 탭처럼 검색 과정 없이 후보 ID가 준비된 흐름에서 사용한다.
    성공 건수가 max_requests에 도달하면 종료하고, 신청 불가/이미 이웃인 ID는 건너뛴다.
    """
    msg_pool = _normalize_messages(messages)
    if not msg_pool and message:
        msg_pool = _normalize_messages(message)

    candidates = _normalize_blog_id_list(blog_ids)
    if not candidates:
        logger.warning("서로이웃 신청 후보가 없습니다")
        return 0

    max_requests = max(1, int(max_requests or 1))
    profile = SPEED_PROFILES.get(speed_mode, SPEED_PROFILES["normal"])
    req_delay = profile["between_requests"]

    today_count = neighbor_quota.get_today_count(naver_id)
    if daily_limit > 0:
        remaining_today = max(0, daily_limit - today_count)
        if remaining_today <= 0:
            logger.warning(
                f"오늘 이미 {today_count}명 신청(상한 {daily_limit}). 내일 다시 실행하세요."
            )
            return 0
        max_requests = min(max_requests, remaining_today)
        logger.info(
            f"일일 상한: {daily_limit}명 / 오늘 이미 {today_count}명 / 이번 실행 최대 {max_requests}명"
        )

    logger.info(
        f"서로이웃 자동 추가 시작 "
        f"({source_label}, 후보 {len(candidates)}명, 최대 신청 {max_requests}명, "
        f"속도={profile['label']}, 멘트 {len(msg_pool)}종, "
        f"Cool-down={cooldown_every}명마다)"
    )

    total_sent = 0
    should_stop = False

    for blog_id in candidates:
        if is_stop_requested(stop_event):
            break
        if total_sent >= max_requests:
            break

        if not _is_session_alive(driver):
            logger.error("브라우저 세션이 끊어져 서로이웃 추가를 중단합니다")
            break

        if daily_limit > 0 and neighbor_quota.get_today_count(naver_id) >= daily_limit:
            logger.info(f"일일 상한 {daily_limit}명 도달. 작업을 중단합니다.")
            break

        picked_message = _pick_message(msg_pool, blog_id)
        result = send_neighbor_request(
            driver, blog_id, message=picked_message,
            naver_id=naver_id, naver_pw=naver_pw, stop_event=stop_event,
        )
        if result is None:
            if not is_stop_requested(stop_event):
                logger.error("세션이 끊어져 남은 블로거를 건너뜁니다")
            should_stop = True
            break
        elif result:
            total_sent += 1
            new_count = neighbor_quota.increment(naver_id)
            logger.info(f"서로이웃 신청 성공: {blog_id} ({total_sent}/{max_requests})")

            if cooldown_every > 0 and new_count > 0 and new_count % cooldown_every == 0:
                cool_secs = random.uniform(*COOLDOWN_RANGE)
                logger.info(
                    f"Cool-down: {new_count}명 신청 → {cool_secs:.0f}초 휴식 "
                    f"(봇 탐지 회피)"
                )
                if not sleep_interruptible(cool_secs, stop_event=stop_event):
                    should_stop = True
                    break

        if total_sent < max_requests and not should_stop:
            if not sleep_interruptible(
                random_delay(*req_delay),
                stop_event=stop_event,
            ):
                break

    final_today = neighbor_quota.get_today_count(naver_id)
    if is_stop_requested(stop_event):
        logger.info(
            f"서로이웃 자동 추가 중지: 이번 실행 {total_sent}명 / 오늘 누적 {final_today}명"
        )
    else:
        logger.info(
            f"서로이웃 자동 추가 완료: 이번 실행 {total_sent}명 / 오늘 누적 {final_today}명"
            + (f" / 일일 상한 {daily_limit}명" if daily_limit > 0 else "")
        )
    return total_sent

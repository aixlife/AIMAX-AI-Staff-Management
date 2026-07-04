import json
import os
import stat
import time
from urllib.parse import urlparse
from utils.logger import get_logger
from paths import SESSIONS_DIR

logger = get_logger(__name__)

SESSIONS_DIR = str(SESSIONS_DIR)

# 쿠키에서 허용할 필드만 추출 (역직렬화 공격 방지)
_ALLOWED_COOKIE_FIELDS = {"name", "value", "domain", "path", "secure", "httpOnly", "expiry", "sameSite"}
_SESSION_MAX_AGE_SECONDS = 30 * 86400


def _get_cookie_path(account_id):
    os.makedirs(SESSIONS_DIR, exist_ok=True)
    return os.path.join(SESSIONS_DIR, f"{account_id}_cookies.json")


def save_session(driver, account_id):
    """로그인 후 쿠키를 파일로 저장 (JSON, 소유자만 읽기)

    현재 도메인 쿠키만 덮어쓰면 블로그/메인 세션이 분리되어 사라질 수 있어,
    기존 파일과 병합하여 최대한 보존한다.
    """
    cookie_path = _get_cookie_path(account_id)
    current_cookies = [
        {k: v for k, v in c.items() if k in _ALLOWED_COOKIE_FIELDS}
        for c in driver.get_cookies()
    ]

    merged = {}
    if os.path.exists(cookie_path):
        try:
            with open(cookie_path, "r", encoding="utf-8") as f:
                saved_cookies = json.load(f)
            for cookie in saved_cookies:
                key = (
                    cookie.get("domain", ""),
                    cookie.get("path", "/"),
                    cookie.get("name", ""),
                )
                merged[key] = cookie
        except Exception as e:
            logger.debug(f"기존 세션 병합 실패 (무시): {e}")

    for cookie in current_cookies:
        key = (
            cookie.get("domain", ""),
            cookie.get("path", "/"),
            cookie.get("name", ""),
        )
        merged[key] = cookie

    cookies = list(merged.values())
    with open(cookie_path, "w", encoding="utf-8") as f:
        json.dump(cookies, f, ensure_ascii=False)
    os.chmod(cookie_path, stat.S_IRUSR | stat.S_IWUSR)  # 600
    domains = set(c.get('domain', '?') for c in cookies)
    logger.info(f"세션 저장 완료: {account_id} (쿠키 {len(cookies)}개, 도메인: {domains})")


def load_session(driver, account_id):
    """저장된 쿠키를 복원하여 재로그인 스킵 시도"""
    cookie_path = _get_cookie_path(account_id)
    if not os.path.exists(cookie_path):
        logger.info(f"저장된 세션 없음: {account_id}")
        return False

    # 쿠키 파일이 너무 오래됐으면 무시한다. 실제 로그인 유효성은 복원 후 다시 확인한다.
    file_age = time.time() - os.path.getmtime(cookie_path)
    if file_age > _SESSION_MAX_AGE_SECONDS:
        logger.info(f"세션 파일 만료 (30일 초과): {account_id}")
        os.remove(cookie_path)
        return False

    try:
        with open(cookie_path, "r", encoding="utf-8") as f:
            cookies = json.load(f)

        domain_groups = {}
        for cookie in cookies:
            domain = (cookie.get("domain") or "").lstrip(".").lower()
            if not domain:
                domain = "www.naver.com"
            if domain.endswith("nid.naver.com"):
                origin = "https://nid.naver.com"
            elif domain.endswith("section.blog.naver.com"):
                origin = "https://section.blog.naver.com"
            elif domain.endswith("blog.naver.com"):
                origin = "https://blog.naver.com"
            else:
                origin = "https://www.naver.com"
            domain_groups.setdefault(origin, []).append(cookie)

        added = 0
        failed = 0
        for origin, items in domain_groups.items():
            try:
                driver.get(origin)
                time.sleep(1)
            except Exception:
                logger.warning(f"세션 복원용 도메인 진입 실패: {origin}")
                failed += len(items)
                continue

            for cookie in items:
                try:
                    driver.add_cookie(cookie)
                    added += 1
                except Exception:
                    failed += 1

        logger.info(f"쿠키 복원: {added}개 성공, {failed}개 실패 (도메인 {list(domain_groups.keys())})")

        driver.get("https://www.naver.com")
        time.sleep(2)

        # 로그인 상태 확인
        page_source = driver.page_source
        if "로그인" not in page_source or "MY" in page_source:
            logger.info(f"세션 복원 성공: {account_id}")
            return True
        else:
            logger.info(f"세션 복원 실패 (재로그인 필요): {account_id}")
            return False
    except Exception as e:
        logger.warning(f"세션 복원 중 오류: {e}")
        return False


def has_recent_session_file(account_id):
    """이 계정으로 이 기기에서 로그인한 이력이 있는지(계정별 세션 파일, 30일 이내) 확인한다.

    fast path 계정 게이트용 — 파일을 읽지 않고 존재/나이만 본다. 판단 불가 시 False(보수적).
    """
    try:
        cookie_path = _get_cookie_path(account_id)
        if not os.path.exists(cookie_path):
            return False
        return (time.time() - os.path.getmtime(cookie_path)) <= _SESSION_MAX_AGE_SECONDS
    except Exception:
        return False


def load_session_cdp(driver, account_id):
    """페이지 이동 없이 CDP(Network.setCookie)로 쿠키를 주입해 세션을 복원한다.

    load_session과 동일한 파일 존재/만료 검사를 거치되, driver.get 같은 페이지 이동 없이
    쿠키만 심는다. 사용자가 겪는 로그인 창 깜빡임/페이지 바운스를 없애기 위함.

    필드 매핑: name, value, domain, path, secure, httpOnly, expiry -> expires.
    name/value 없는 쿠키는 건너뛴다. 성공 개수를 센다.

    어떤 예외든 발생하면 기존 load_session(페이지 이동 방식)으로 폴백한다.
    반환값: 쿠키 주입 성공 여부(True/False). 실제 로그인 유효성은 호출부에서 다시 확인한다.
    """
    try:
        cookie_path = _get_cookie_path(account_id)
        if not os.path.exists(cookie_path):
            logger.info(f"저장된 세션 없음(CDP): {account_id}")
            return False

        # 쿠키 파일이 너무 오래됐으면 무시한다. 실제 유효성은 복원 후 다시 확인한다.
        file_age = time.time() - os.path.getmtime(cookie_path)
        if file_age > _SESSION_MAX_AGE_SECONDS:
            logger.info(f"세션 파일 만료(CDP, 30일 초과): {account_id}")
            os.remove(cookie_path)
            return False

        with open(cookie_path, "r", encoding="utf-8") as f:
            cookies = json.load(f)

        added = 0
        skipped = 0
        for cookie in cookies:
            name = cookie.get("name")
            value = cookie.get("value")
            if not name or value is None:
                skipped += 1
                continue

            params = {"name": name, "value": value}
            domain = cookie.get("domain")
            if domain:
                params["domain"] = domain
            params["path"] = cookie.get("path", "/")
            if "secure" in cookie:
                params["secure"] = bool(cookie.get("secure"))
            if "httpOnly" in cookie:
                params["httpOnly"] = bool(cookie.get("httpOnly"))
            if cookie.get("expiry") is not None:
                params["expires"] = cookie.get("expiry")

            # 예외는 바깥 try로 전파시켜 기존 load_session으로 폴백하도록 한다.
            driver.execute_cdp_cmd("Network.setCookie", params)
            added += 1

        logger.info(f"쿠키 CDP 주입: {added}개 성공, {skipped}개 건너뜀 (페이지 이동 없음)")
        return added > 0
    except Exception as e:
        logger.warning(f"CDP 세션 복원 실패 - 기존 방식으로 폴백: {e}")
        return load_session(driver, account_id)


def sync_pc_blog_login(driver):
    """blog.naver.com 로그인 세션 동기화 (NID 경유)

    www.naver.com에서 세션 복원 후, blog.naver.com + cbox에서도
    로그인 상태가 인식되도록 NID 로그인 페이지를 경유합니다.

    NID가 .naver.com 쿠키(NID_AUT 등)를 인식하면
    자동으로 blog.naver.com으로 리다이렉트되며,
    이 과정에서 blog.naver.com 도메인에 로그인 쿠키가 설정됩니다.

    댓글 기능 사용 전에 반드시 1회 호출해야 합니다.
    """
    try:
        logger.info("PC 블로그 로그인 동기화 중 (NID 경유)...")
        driver.get(
            "https://nid.naver.com/nidlogin.login"
            "?svctype=262144&url=https://blog.naver.com"
        )
        time.sleep(4)

        current = driver.current_url
        # 호스트명으로만 확인 - URL 쿼리파라미터 ?url=https://blog.naver.com 을 오탐하지 않기 위함
        current_host = urlparse(current).hostname or ""
        if current_host == "blog.naver.com" or current_host.endswith(".blog.naver.com"):
            # blog.naver.com에 도착 → 로그인 상태 재확인
            page = driver.page_source
            if "btn_blog_login" in page:
                logger.warning("NID 경유했으나 blog.naver.com 여전히 로그아웃")
                return False
            logger.info("PC 블로그 로그인 동기화 성공")
            return True

        if current_host == "nid.naver.com" or current_host.endswith(".nid.naver.com"):
            logger.warning("NID 세션 미인식 - blog.naver.com 동기화 실패 (재로그인 필요)")
            return False

        logger.info(f"NID 리다이렉트 결과 URL: {current[:80]}")
        return False
    except Exception as e:
        logger.warning(f"PC 블로그 로그인 동기화 오류: {e}")
        return False

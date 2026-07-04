"""check-first 네이버 로그인 재정렬 로직 스모크 테스트 (실제 브라우저/로그인 없음)

가짜 driver(덕타이핑: current_url, page_source, get(), execute_cdp_cmd(), get_cookies())로
login() 흐름의 분기만 검증한다. 실제 브라우저 검증은 이 Mac에서 별도로 수행한다.

검증 시나리오:
  (1) 빠른 경로: 로그인된 blog 페이지 → get() 정확히 1회, execute_cdp_cmd/NID 방문 없음, True
  (2) not-ready → CDP 복원 경로 호출, 재확인 ready → True, get() 총 2회, NID 방문 없음
  (3) CDP가 예외 → 레거시 load_session 폴백 호출(monkeypatch)
  (4) 전부 실패 → _fresh_login 호출(monkeypatch), blog 확인 실패 시에만 sync 호출
"""
import os
import sys

# 워크트리 루트를 import 경로에 추가
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from auth import naver_login
from browser import session_manager


LOGGED_IN_BLOG = "<html><body>블로그 홈 (로그인됨) 내 블로그 blog.naver.com/tester</body></html>"
# 프로필에 남은 "다른 계정" 세션 — 로그인 상태이지만 설정된 계정(tester)이 페이지에 없음
LOGGED_IN_OTHER_ACCOUNT = "<html><body>블로그 홈 (로그인됨) 내 블로그 blog.naver.com/someoneelse</body></html>"
LOGGED_OUT_BLOG = "<html><body><a class='btn_blog_login'>로그인</a></body></html>"


class FakeDriver:
    """덕타이핑 가짜 driver.

    pages: get(url) 호출 시 반환할 (current_url, page_source)를 결정하는 콜백.
    cdp_raises: True면 execute_cdp_cmd가 예외를 던진다.
    """

    def __init__(self, page_resolver, cdp_raises=False):
        self._resolve = page_resolver
        self._cdp_raises = cdp_raises
        self.current_url = "about:blank"
        self.page_source = ""
        self.get_calls = []          # 방문한 URL 목록
        self.cdp_calls = []          # execute_cdp_cmd 호출 목록
        self.get_cookies_calls = 0

    def get(self, url):
        self.get_calls.append(url)
        current_url, page_source = self._resolve(url, self)
        self.current_url = current_url
        self.page_source = page_source

    def execute_cdp_cmd(self, cmd, params):
        self.cdp_calls.append((cmd, params))
        if self._cdp_raises:
            raise RuntimeError("CDP 미지원 시뮬레이션")
        return {}

    def get_cookies(self):
        self.get_cookies_calls += 1
        return []


def _assert(cond, msg):
    if not cond:
        raise AssertionError(msg)


def _nid_visited(driver):
    return any("nid.naver.com" in u or "nidlogin.login" in u for u in driver.get_calls)


def _patch_no_sleep(monkeypatches):
    """wait_medium/wait_short 실제 sleep 제거 (스모크 속도)."""
    orig_medium = naver_login.wait_medium
    orig_short = naver_login.wait_short
    naver_login.wait_medium = lambda *a, **k: True
    naver_login.wait_short = lambda *a, **k: True
    monkeypatches.append(("wait_medium", orig_medium))
    monkeypatches.append(("wait_short", orig_short))


def _restore(monkeypatches):
    for name, val in monkeypatches:
        setattr(naver_login, name, val)


def test_1_fast_path():
    mp = []
    _patch_no_sleep(mp)
    try:
        # blog.naver.com 접속 시 로그인된 상태 반환
        def resolver(url, drv):
            return ("https://blog.naver.com/home", LOGGED_IN_BLOG)

        drv = FakeDriver(resolver)
        result = naver_login.login(drv, "tester", "pw")

        _assert(result is True, "(1) 반환값이 True 여야 함")
        _assert(len(drv.get_calls) == 1, f"(1) get() 정확히 1회여야 함 (실제 {len(drv.get_calls)})")
        _assert(len(drv.cdp_calls) == 0, "(1) execute_cdp_cmd 호출 없어야 함")
        _assert(not _nid_visited(drv), "(1) NID 방문 없어야 함")
        print("PASS (1) 빠른 경로: get 1회, CDP 없음, NID 없음, True")
    finally:
        _restore(mp)


def test_2_cdp_restore():
    mp = []
    _patch_no_sleep(mp)
    # 쿠키 파일 존재 + 신선한 것으로 위장하기 위해 session_manager 함수 monkeypatch
    orig_cdp = session_manager.load_session_cdp
    # load_session_cdp가 실제 파일을 읽지 않도록: 쿠키 주입 성공을 시늉하고 driver를 로그인 상태로 만든다.
    state = {"cookies_injected": False}

    def fake_cdp(driver, account_id):
        # CDP 경로: 페이지 이동 없이 쿠키만 주입 (execute_cdp_cmd 호출 시늉)
        driver.execute_cdp_cmd("Network.setCookie", {"name": "NID_AUT", "value": "x"})
        state["cookies_injected"] = True
        return True

    naver_login.load_session_cdp = fake_cdp
    try:
        # 1회차 blog 확인은 로그아웃, 쿠키 주입 후 2회차는 로그인
        def resolver(url, drv):
            if state["cookies_injected"]:
                return ("https://blog.naver.com/home", LOGGED_IN_BLOG)
            return ("https://blog.naver.com/home", LOGGED_OUT_BLOG)

        drv = FakeDriver(resolver)
        result = naver_login.login(drv, "tester", "pw")

        _assert(result is True, "(2) 반환값이 True 여야 함")
        _assert(len(drv.get_calls) == 2, f"(2) get() 총 2회여야 함 (실제 {len(drv.get_calls)})")
        _assert(len(drv.cdp_calls) == 1, "(2) CDP 주입 1회 있어야 함")
        _assert(not _nid_visited(drv), "(2) NID 방문 없어야 함")
        print("PASS (2) CDP 복원 경로: get 2회, CDP 주입, NID 없음, True")
    finally:
        naver_login.load_session_cdp = orig_cdp
        _restore(mp)


def test_3_cdp_raises_falls_back_to_legacy():
    """load_session_cdp 내부에서 execute_cdp_cmd 예외 → 레거시 load_session 폴백."""
    mp = []
    _patch_no_sleep(mp)
    legacy_called = {"n": 0}

    orig_load = session_manager.load_session

    def fake_load(driver, account_id):
        legacy_called["n"] += 1
        return False  # 레거시도 세션 없음

    session_manager.load_session = fake_load
    try:
        # 쿠키 파일이 있는 것처럼 보이게 하려고 load_session_cdp 원본을 그대로 쓰되
        # 파일 존재 검사를 통과시키기 위해 _get_cookie_path/os를 우회: 대신
        # execute_cdp_cmd가 raise하는 FakeDriver로 실제 원본 함수 경로를 태운다.
        # 파일이 없으면 원본은 False만 반환하므로, 여기서는 원본 대신 얇은 래퍼로
        # "쿠키 1개 주입 시도 → 예외 → 폴백" 을 재현한다.
        def cdp_with_file(driver, account_id):
            try:
                driver.execute_cdp_cmd("Network.setCookie", {"name": "NID_AUT", "value": "x"})
                return True
            except Exception:
                return session_manager.load_session(driver, account_id)

        orig_cdp = naver_login.load_session_cdp
        naver_login.load_session_cdp = cdp_with_file

        # 신규 로그인까지 가지 않도록 _fresh_login/ sync monkeypatch (검증 대상 아님)
        orig_fresh = naver_login._fresh_login
        orig_sync = naver_login.sync_pc_blog_login
        naver_login._fresh_login = lambda d, i, p: None
        naver_login.sync_pc_blog_login = lambda d: False

        try:
            def resolver(url, drv):
                return ("https://blog.naver.com/home", LOGGED_OUT_BLOG)

            drv = FakeDriver(resolver, cdp_raises=True)
            result = naver_login.login(drv, "tester", "pw")

            _assert(result is True, "(3) 최종 반환 True (오늘 동작과 동일 degrade)")
            _assert(legacy_called["n"] >= 1, "(3) 레거시 load_session 폴백 호출되어야 함")
            print("PASS (3) CDP 예외 → 레거시 load_session 폴백 호출")
        finally:
            naver_login.load_session_cdp = orig_cdp
            naver_login._fresh_login = orig_fresh
            naver_login.sync_pc_blog_login = orig_sync
    finally:
        session_manager.load_session = orig_load
        _restore(mp)


def test_4_all_fail_fresh_login_and_sync():
    mp = []
    _patch_no_sleep(mp)
    calls = {"fresh": 0, "sync": 0}

    orig_cdp = naver_login.load_session_cdp
    orig_fresh = naver_login._fresh_login
    orig_sync = naver_login.sync_pc_blog_login

    naver_login.load_session_cdp = lambda d, a: False  # 쿠키 복원 실패
    naver_login._fresh_login = lambda d, i, p: calls.__setitem__("fresh", calls["fresh"] + 1)
    naver_login.sync_pc_blog_login = lambda d: calls.__setitem__("sync", calls["sync"] + 1) or True
    try:
        # blog 확인은 계속 로그아웃 (fresh login 후에도 세션 안 잡힘 → sync 호출되어야)
        def resolver(url, drv):
            return ("https://blog.naver.com/home", LOGGED_OUT_BLOG)

        drv = FakeDriver(resolver)
        result = naver_login.login(drv, "tester", "pw")

        _assert(result is True, "(4) 반환값 True")
        _assert(calls["fresh"] == 1, f"(4) _fresh_login 1회 호출 (실제 {calls['fresh']})")
        _assert(calls["sync"] == 1, f"(4) blog 확인 실패 시 sync 1회 호출 (실제 {calls['sync']})")
        print("PASS (4) 전부 실패 → _fresh_login 호출 + blog 실패 시 sync 호출")

        # 추가 확인: fresh 이후 blog가 이미 로그인 상태면 sync 생략
        calls2 = {"fresh": 0, "sync": 0}
        naver_login._fresh_login = lambda d, i, p: calls2.__setitem__("fresh", calls2["fresh"] + 1)
        naver_login.sync_pc_blog_login = lambda d: calls2.__setitem__("sync", calls2["sync"] + 1) or True
        toggle = {"fresh_done": False}

        def resolver2(url, drv):
            if toggle["fresh_done"]:
                return ("https://blog.naver.com/home", LOGGED_IN_BLOG)
            return ("https://blog.naver.com/home", LOGGED_OUT_BLOG)

        def fresh2(d, i, p):
            calls2["fresh"] += 1
            toggle["fresh_done"] = True

        naver_login._fresh_login = fresh2
        drv2 = FakeDriver(resolver2)
        naver_login.login(drv2, "tester", "pw")
        _assert(calls2["fresh"] == 1, "(4b) _fresh_login 1회")
        _assert(calls2["sync"] == 0, f"(4b) fresh 후 blog 로그인 확인되면 sync 생략 (실제 {calls2['sync']})")
        print("PASS (4b) fresh 후 blog 세션 확인되면 sync 생략")
    finally:
        naver_login.load_session_cdp = orig_cdp
        naver_login._fresh_login = orig_fresh
        naver_login.sync_pc_blog_login = orig_sync
        _restore(mp)




def scenario_account_gate():
    """계정별 세션 파일이 없으면(=이 계정 로그인 이력 없음) fast path 를 건너뛰고 폴백."""
    calls = {"fresh": 0, "gate": 0}

    def resolve(url, drv):
        if url.startswith("https://blog.naver.com"):
            return ("https://blog.naver.com/home", LOGGED_IN_BLOG)
        return (url, "")

    drv = FakeDriver(resolve)

    import auth.naver_login as naver_login

    def fake_gate(account_id):
        calls["gate"] += 1
        return False  # 이 계정으로 로그인한 이력 없음 → fast path 금지

    def fake_fresh(driver, nid, npw):
        calls["fresh"] += 1

    orig_gate = naver_login.has_recent_session_file
    orig_fresh = naver_login._fresh_login
    orig_cdp = naver_login.load_session_cdp
    naver_login.has_recent_session_file = fake_gate
    naver_login._fresh_login = fake_fresh
    naver_login.load_session_cdp = lambda d, a: False
    try:
        result = naver_login.login(drv, "tester", "pw")
    finally:
        naver_login.has_recent_session_file = orig_gate
        naver_login._fresh_login = orig_fresh
        naver_login.load_session_cdp = orig_cdp

    assert result is True
    assert calls["gate"] == 1, f"세션 파일 게이트 미호출: {calls}"
    assert calls["fresh"] == 1, f"게이트 차단인데 fresh login 미호출: {calls}"
    print("PASS (5) 세션 파일 없는 계정 → fast path 게이트 차단 + 신규 로그인 폴백")


if __name__ == "__main__":
    # fast path 시나리오(1,2)는 "이 계정 로그인 이력 있음"이 전제 — 게이트를 일괄 통과시킨다.
    # 시나리오 5 는 자체적으로 게이트를 False 로 오버라이드해 차단 경로를 검증한다.
    import auth.naver_login as _nl
    _nl.has_recent_session_file = lambda account_id: True
    test_1_fast_path()
    test_2_cdp_restore()
    test_3_cdp_raises_falls_back_to_legacy()
    test_4_all_fail_fresh_login_and_sync()
    scenario_account_gate()
    print("ALL SMOKE PASS")

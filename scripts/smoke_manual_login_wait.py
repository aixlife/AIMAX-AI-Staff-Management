"""네이버 수동 재로그인 대기 스모크 테스트 (실제 브라우저 없음)

가짜 driver와 monkeypatch로 다음 계약만 검증한다.
  (a) 자동 신규 로그인 실패 후 사용자가 브라우저에서 로그인 완료 → login() True + save_session 호출
  (b) 수동 로그인 타임아웃 → RuntimeError 메시지에 "네이버 로그인" 포함
  (c) fast-path 성공 → 반환 직전 save_session 호출
"""
import os
import sys
import types

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

try:
    import pyperclip  # noqa: F401
except ModuleNotFoundError:
    pyperclip_stub = types.ModuleType("pyperclip")
    pyperclip_stub.copy = lambda value: None
    sys.modules["pyperclip"] = pyperclip_stub

try:
    import selenium  # noqa: F401
except ModuleNotFoundError:
    selenium_mod = types.ModuleType("selenium")
    webdriver_mod = types.ModuleType("selenium.webdriver")
    common_mod = types.ModuleType("selenium.webdriver.common")
    by_mod = types.ModuleType("selenium.webdriver.common.by")
    keys_mod = types.ModuleType("selenium.webdriver.common.keys")
    action_mod = types.ModuleType("selenium.webdriver.common.action_chains")
    support_mod = types.ModuleType("selenium.webdriver.support")
    ui_mod = types.ModuleType("selenium.webdriver.support.ui")

    class By:
        CSS_SELECTOR = "css selector"

    class Keys:
        META = "META"
        CONTROL = "CONTROL"
        DELETE = "DELETE"

    class ActionChains:
        def __init__(self, driver):
            self.driver = driver

        def key_down(self, key):
            return self

        def key_up(self, key):
            return self

        def send_keys(self, keys):
            return self

        def perform(self):
            return None

    class WebDriverWait:
        def __init__(self, driver, timeout, poll_frequency=0.5):
            self.driver = driver
            self.timeout = timeout
            self.poll_frequency = poll_frequency

        def until(self, condition):
            if condition(self.driver):
                return True
            raise TimeoutError("condition not met")

    by_mod.By = By
    keys_mod.Keys = Keys
    action_mod.ActionChains = ActionChains
    ui_mod.WebDriverWait = WebDriverWait

    sys.modules["selenium"] = selenium_mod
    sys.modules["selenium.webdriver"] = webdriver_mod
    sys.modules["selenium.webdriver.common"] = common_mod
    sys.modules["selenium.webdriver.common.by"] = by_mod
    sys.modules["selenium.webdriver.common.keys"] = keys_mod
    sys.modules["selenium.webdriver.common.action_chains"] = action_mod
    sys.modules["selenium.webdriver.support"] = support_mod
    sys.modules["selenium.webdriver.support.ui"] = ui_mod

from auth import naver_login


class FakeDriver:
    def __init__(self, urls=None):
        self._urls = list(urls or [])
        self._current_url = "about:blank"
        self.get_calls = []
        self.cdp_calls = []

    @property
    def current_url(self):
        if self._urls:
            self._current_url = self._urls.pop(0)
        return self._current_url

    def get(self, url):
        self.get_calls.append(url)
        self._current_url = url

    def execute_cdp_cmd(self, cmd, params):
        self.cdp_calls.append((cmd, params))
        return {}

    def get_cookies(self):
        return [{"name": "NID_AUT", "value": "x", "domain": ".naver.com", "path": "/"}]


class PatchBag:
    def __init__(self):
        self._items = []

    def set(self, obj, name, value):
        self._items.append((obj, name, getattr(obj, name)))
        setattr(obj, name, value)

    def restore(self):
        for obj, name, value in reversed(self._items):
            setattr(obj, name, value)


class FakeClock:
    def __init__(self):
        self.now = 0

    def monotonic(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


def _assert(condition, message):
    if not condition:
        raise AssertionError(message)


def _base_patches(save_calls):
    patches = PatchBag()
    patches.set(naver_login, "has_recent_session_file", lambda account_id: False)
    patches.set(naver_login, "load_session_cdp", lambda driver, account_id: False)
    patches.set(naver_login, "sync_pc_blog_login", lambda driver: True)
    patches.set(naver_login, "save_session", lambda driver, account_id: save_calls.append(account_id))
    return patches


def scenario_manual_login_completes():
    save_calls = []
    patches = _base_patches(save_calls)
    clock = FakeClock()
    patches.set(naver_login.time, "monotonic", clock.monotonic)
    patches.set(naver_login.time, "sleep", clock.sleep)
    patches.set(naver_login, "_fresh_login", lambda driver, account_id, password: (_ for _ in ()).throw(RuntimeError("CAPTCHA가 발생했습니다.")))
    patches.set(naver_login, "_blog_session_ready", lambda driver, account_id=None: True)
    try:
        driver = FakeDriver([
            "https://nid.naver.com/nidlogin.login",
            "https://blog.naver.com/tester",
        ])
        result = naver_login.login(driver, "tester", "pw")
        _assert(result is True, "(a) login() 반환값이 True 여야 함")
        _assert(save_calls == ["tester"], f"(a) save_session 1회 호출 필요: {save_calls}")
        print("PASS (a) 수동 로그인 완료 후 login() True + save_session 호출")
    finally:
        patches.restore()


def scenario_manual_login_timeout():
    save_calls = []
    patches = _base_patches(save_calls)
    clock = FakeClock()
    patches.set(naver_login.time, "monotonic", clock.monotonic)
    patches.set(naver_login.time, "sleep", clock.sleep)
    patches.set(naver_login, "_fresh_login", lambda driver, account_id, password: (_ for _ in ()).throw(RuntimeError("자동 로그인이 차단되었습니다.")))
    patches.set(naver_login, "_blog_session_ready", lambda driver, account_id=None: False)
    try:
        driver = FakeDriver(["https://nid.naver.com/nidlogin.login"] * 100)
        try:
            naver_login.login(driver, "tester", "pw")
        except RuntimeError as e:
            message = str(e)
            _assert("네이버 로그인" in message, f"(b) 오류 메시지에 '네이버 로그인' 포함 필요: {message}")
            _assert(not save_calls, f"(b) 타임아웃 시 save_session 호출 없어야 함: {save_calls}")
            print("PASS (b) 수동 로그인 타임아웃 → RuntimeError 메시지에 '네이버 로그인' 포함")
            return
        raise AssertionError("(b) 타임아웃 시 RuntimeError가 발생해야 함")
    finally:
        patches.restore()


def scenario_fast_path_saves_session():
    save_calls = []
    patches = _base_patches(save_calls)
    patches.set(naver_login, "has_recent_session_file", lambda account_id: True)
    patches.set(naver_login, "_blog_session_ready", lambda driver, account_id=None: True)
    patches.set(naver_login, "_fresh_login", lambda driver, account_id, password: (_ for _ in ()).throw(AssertionError("_fresh_login 호출 금지")))
    try:
        driver = FakeDriver()
        result = naver_login.login(driver, "tester", "pw")
        _assert(result is True, "(c) login() 반환값이 True 여야 함")
        _assert(save_calls == ["tester"], f"(c) fast-path save_session 1회 호출 필요: {save_calls}")
        print("PASS (c) fast-path 성공 경로 → save_session 호출")
    finally:
        patches.restore()


def main():
    scenarios = [
        scenario_manual_login_completes,
        scenario_manual_login_timeout,
        scenario_fast_path_saves_session,
    ]
    failures = 0
    for scenario in scenarios:
        try:
            scenario()
        except Exception as e:
            failures += 1
            print(f"FAIL {scenario.__name__}: {e}")
    if failures:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""스모크: 네이버 NID 로그인 버튼 탐색이 신·구 로그인 화면 모두에서 동작하는지 검증한다.

배경 (2026-08-18): 네이버가 NID 로그인 화면을 개편(V3_DESKTOP_DEFAULT)하면서 기존
`#log.login` 버튼이 사라지고 레이아웃별 `#loginBtn_column` / `#loginBtn_row` 로 바뀌었다.
그 결과 예리 글쓰기 잡이 "로그인 버튼을 찾을 수 없습니다"로 실패했다(8/15~8/17 6건).

셀레니움 없이 순수 파이썬 스텁 드라이버로 선택자 결정 로직만 검증한다.

실행: python3 scripts/smoke_naver_login_button.py
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

# selenium 미설치 환경에서도 돌도록 auth.naver_login 의 무거운 의존성을 스텁으로 채운다.
import types

for name, attrs in {
    "pyperclip": {"copy": lambda *_: None},
    "selenium": {},
    "selenium.webdriver": {},
    "selenium.webdriver.common": {},
    "selenium.webdriver.common.by": {"By": type("By", (), {"CSS_SELECTOR": "css selector"})},
    "selenium.webdriver.common.keys": {"Keys": type("Keys", (), {"META": "meta", "CONTROL": "ctrl", "DELETE": "del"})},
    "selenium.webdriver.common.action_chains": {"ActionChains": object},
    "selenium.webdriver.support": {},
    "selenium.webdriver.support.ui": {"WebDriverWait": object},
}.items():
    if name in sys.modules:
        continue
    module = types.ModuleType(name)
    for key, value in attrs.items():
        setattr(module, key, value)
    sys.modules[name] = module

from auth.naver_login import _click_login_button, _find_login_button  # noqa: E402

FAILURES: list[str] = []


def check(label: str, actual, expected) -> None:
    if actual == expected:
        print(f"  PASS {label}")
        return
    FAILURES.append(f"{label}: expected={expected!r} actual={actual!r}")
    print(f"  FAIL {label}: expected={expected!r} actual={actual!r}")


class FakeElement:
    def __init__(self, element_id="", text="", value="", displayed=True, enabled=True, click_raises=False):
        self.element_id = element_id
        self.text = text
        self.value = value
        self.displayed = displayed
        self.enabled = enabled
        self.click_raises = click_raises
        self.clicked = False

    def get_attribute(self, name):
        if name == "id":
            return self.element_id
        if name == "value":
            return self.value
        return None

    def is_displayed(self):
        return self.displayed

    def is_enabled(self):
        return self.enabled

    def click(self):
        if self.click_raises:
            raise RuntimeError("element not interactable")
        self.clicked = True

    def __repr__(self):
        return f"<FakeElement {self.element_id or self.text!r}>"


class FakeDriver:
    """CSS 선택자 → 요소 목록 매핑만 흉내내는 스텁."""

    def __init__(self, by_selector):
        self.by_selector = by_selector
        self.js_clicked = []

    def find_elements(self, _by, selector):
        return list(self.by_selector.get(selector, []))

    def execute_script(self, _script, element):
        self.js_clicked.append(element)
        element.clicked = True


print("[1] 새 로그인 화면 (2026-08 개편): column 레이아웃만 노출")
new_column = FakeElement("loginBtn_column", text="로그인")
new_row = FakeElement("loginBtn_row", text="로그인", displayed=False)
driver = FakeDriver({"#loginBtn_column": [new_column], "#loginBtn_row": [new_row]})
check("보이는 column 버튼 선택", _find_login_button(driver), new_column)
check("클릭 성공", _click_login_button(driver), True)
check("실제 클릭된 요소", new_column.clicked, True)

print("[2] 새 로그인 화면: row 레이아웃만 노출 (숨은 column 을 고르면 조용히 실패한다)")
hidden_column = FakeElement("loginBtn_column", text="로그인", displayed=False)
visible_row = FakeElement("loginBtn_row", text="로그인")
driver = FakeDriver({"#loginBtn_column": [hidden_column], "#loginBtn_row": [visible_row]})
check("보이는 row 버튼 선택", _find_login_button(driver), visible_row)

print("[3] 구 로그인 화면 (#log.login) 회귀 — 네이버 A/B 롤백 대비")
legacy = FakeElement("log.login", text="로그인")
driver = FakeDriver({"#log\\.login": [legacy]})
check("구 버튼 선택", _find_login_button(driver), legacy)
check("클릭 성공", _click_login_button(driver), True)

print("[4] 알려진 선택자 전멸 → 폼 안 '로그인' 라벨 폴백")
passkey = FakeElement("passkeyBtn_column", text="패스키 로그인")
generic = FakeElement("someNewLoginBtn", text="로그인")
delete_btn = FakeElement("", text="")
driver = FakeDriver({"#frmNIDLogin button, #frmNIDLogin input[type='submit']": [delete_btn, passkey, generic]})
found = _find_login_button(driver)
check("폴백으로 로그인 버튼 발견", found, generic)
check("패스키 버튼은 절대 고르지 않음", found is passkey, False)

print("[5] 로그인 버튼이 아예 없으면 기존 계약대로 RuntimeError")
driver = FakeDriver({})
check("후보 없음 → None", _find_login_button(driver), None)
try:
    _click_login_button(driver)
    check("RuntimeError 발생", False, True)
except RuntimeError as exc:
    check("RuntimeError 발생", True, True)
    # 서버 자동안내 분류(naver_login_page_changed)가 이 문구를 신호로 쓴다. 바꾸면 같이 고칠 것.
    check("분류 신호 문구 보존", "로그인 버튼을 찾을 수 없" in str(exc), True)

print("[6] 네이티브 클릭이 막히면 JS 클릭으로 폴백")
blocked = FakeElement("loginBtn_column", text="로그인", click_raises=True)
driver = FakeDriver({"#loginBtn_column": [blocked]})
check("JS 폴백 클릭 성공", _click_login_button(driver), True)
check("JS 클릭 경로 사용", driver.js_clicked, [blocked])

print("[7] 자동안내 스윕(aimax_report_auto_guidance.py)이 server.js 와 같은 분류를 낸다")
sys.path.insert(0, str(REPO_ROOT / "scripts"))
import aimax_report_auto_guidance as sweep  # noqa: E402

RUNNER_ERROR = (
    "클로드사용법 완벽 가이드: 효율적인 AI 업무 활용 팁 처리 실패: "
    "로그인 버튼을 찾을 수 없습니다. 네이버 페이지 구조가 변경되었을 수 있습니다."
)
row = {
    "report_kind": "error",
    "status": "new",
    "work_context": "예리 글쓰기 중",
    "visible_error": RUNNER_ERROR,
}
guidance = sweep.classify(row, None, {})
check("스윕 분류", getattr(guidance, "category", None), "naver_login_page_changed")
check("상태 = reviewing", getattr(guidance, "status", None), "reviewing")

# 진짜 보안 확인 건은 그대로 사용자 조치로 남아야 한다(회귀).
real_login = {
    "report_kind": "error",
    "status": "new",
    "work_context": "예리 글쓰기",
    "visible_error": "네이버 로그인 2단계 인증 화면에서 새 기기 등록을 요구합니다",
}
check("2단계 인증은 기존 분류 유지", getattr(sweep.classify(real_login, None, {}), "category", None), "naver_login_required")

# still_failing 재응답이 와도 "다시 로그인해보라"로 되돌리지 않는다.
still = dict(row, status="reviewing", user_response="still_failing", auto_guidance_category="naver_login_page_changed")
check("still_failing → 사용자 조치로 강등 안 함", sweep.still_failing_guidance(still), None)

# 7/24 실측 재현: 에디터 구조 변경 건이 selenium 로그의 'driver' 문자열 때문에
# browser_driver_policy_blocked("보안 프로그램 차단 허용하세요")로 넘어가려 했다.
editor_still = {
    "report_kind": "error",
    "status": "reviewing",
    "user_response": "still_failing",
    "auto_guidance_category": "editor_structure_changed",
    "work_context": "블로그 작업중이였습니다.",
    "visible_error": (
        "AIMAX 관리자 조치 필요 단계: smart_editor_title "
        "Message: no such element: Unable to locate element: "
        '{"method":"css selector","selector":".se-section-documentTitle"} '
        "(Session info: chrome=139) driver info: chromedriver"
    ),
}
check("에디터 구조 건은 드라이버 차단으로 강등 안 함", sweep.still_failing_guidance(editor_still), None)

# 진짜 네이버 보안 확인 건은 still_failing 승급 경로가 그대로 살아 있어야 한다(회귀).
naver_still = {
    "report_kind": "error",
    "status": "reviewing",
    "user_response": "still_failing",
    "auto_guidance_category": "naver_login_required",
    "work_context": "예리 글쓰기",
    "visible_error": "네이버 로그인 2단계 인증 화면에서 계속 멈춥니다",
}
check(
    "2단계 인증 still_failing 승급 유지",
    getattr(sweep.still_failing_guidance(naver_still), "category", None),
    "naver_login_required_still_failing",
)

print()
if FAILURES:
    print(f"FAIL {len(FAILURES)}건")
    for line in FAILURES:
        print(f" - {line}")
    sys.exit(1)
print("ALL PASS")

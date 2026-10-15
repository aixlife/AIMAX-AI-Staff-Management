"""임시저장 확인 방법·발행 주소 읽기 스모크(가짜 드라이버, 네트워크 없음).

2026-10-15 전수조사 #7: 글 수가 저장 전후 98로 고정돼, '자동저장 표시 + 글 수>0' 이면 새 저장이 없어도
성공으로 통과했다. 이제는 무엇으로 확인했는지 돌려주고, 그 경우는 "unverified" 로 구분한다.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import posting.publisher as pub  # noqa: E402


class FakeDriver:
    def __init__(self, body="", count=None, autosave="", url=""):
        self.body, self.count, self.autosave, self.current_url = body, count, autosave, url

    def execute_script(self, script, *args):
        if "innerText : ''" in script:
            return self.body
        if "aria-label" in script:
            return self.count
        if "autosave_message" in script:
            return self.autosave
        return None


def wait(driver, **kw):
    return pub._wait_draft_saved(driver, timeout=0.5, **kw)


# 1) 98 고정 + 자동저장 문구 그대로 → 예전엔 True, 이제 "unverified"
d = FakeDriver(count=98, autosave="자동저장 완료 15:00")
assert wait(d, baseline_count=98, baseline_autosave="자동저장 완료 15:00") == "unverified"
# 2) 저장 전부터 있던 '저장되었습니다' 문구는 증거가 아님
d = FakeDriver(body="설정이 저장되었습니다", count=98)
assert wait(d, baseline_count=98, baseline_toasts={"저장되었습니다"}) == ""
# 3) 새 토스트
d = FakeDriver(body="임시저장 되었습니다", count=98)
assert wait(d, baseline_count=98, baseline_toasts=set()) == "toast"
# 4) 글 수 증가
d = FakeDriver(count=99)
assert wait(d, baseline_count=98) == "count"
# 5) 자동저장 문구 변화
d = FakeDriver(count=98, autosave="자동저장 완료 15:01")
assert wait(d, baseline_count=98, baseline_autosave="자동저장 완료 15:00") == "autosave_changed"
# 6) 아무 증거 없음
assert wait(FakeDriver(count=None)) == ""

# 발행 주소
cap = pub._capture_post_url(FakeDriver(url="https://blog.naver.com/likimartin/224012345678"), timeout=0.3)
assert cap == {"url": "https://blog.naver.com/likimartin/224012345678", "log_no": "224012345678"}, cap
cap = pub._capture_post_url(FakeDriver(url="https://blog.naver.com/PostView.naver?blogId=a&logNo=223"), timeout=0.3)
assert cap["log_no"] == "223", cap
cap = pub._capture_post_url(FakeDriver(url="https://blog.naver.com/likimartin/postwrite"), timeout=0.3)
assert cap == {"url": "", "log_no": ""}, cap
print("DRAFT_CONFIRM_METHOD_SMOKE_OK")

#!/usr/bin/env python3
"""스모크: 에디터 입력 검증 기준과 표/목록 처리 회귀.

배경 (2026-08-26): v1.0.63 이후 예리 글쓰기가 smart_editor_input_verification 에서
3전 3패했다. 원인이 둘이었다.
 1) 검증이 공백 포함 값(measure_visible_char_count)과 공백 제거 값(editor_visible_text_count)을
    비교해, 글이 100% 입력돼도 여유가 2.5%(1218 대 1188)뿐이었다.
 2) 표는 rows[:3] 으로 4행째를 말없이 버렸고, 표·목록에서 빠져나왔는지 확인하지 않아
    이어지는 문단이 표 칸/목록 항목으로 들어갔다.

실행: python3 scripts/smoke_editor_input_verification.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from content.ai_text import measure_editor_comparable_char_count, measure_visible_char_count  # noqa: E402
# posting.editor 는 selenium·pyperclip 을 임포트한다. 스모크는 소스만 검사하므로
# 무거운 의존성 없이 파일 텍스트를 직접 읽어 함수 본문을 꺼낸다.
EDITOR_SRC = (ROOT / "posting" / "editor.py").read_text(encoding="utf-8")


def func_source(name: str) -> str:
    start = EDITOR_SRC.index(f"def {name}(")
    rest = EDITOR_SRC[start:]
    lines = rest.splitlines()
    body = [lines[0]]
    for line in lines[1:]:
        if line and not line[0].isspace() and not line.startswith(")"):
            break
        body.append(line)
    return "\n".join(body)

passed = 0
failed = 0


def check(name, actual, expected):
    global passed, failed
    if actual == expected:
        passed += 1
        print(f"  PASS  {name}  (={actual})")
    else:
        failed += 1
        print(f"  FAIL  {name}  expected={expected} actual={actual}")


# 8/26 실패 원고(b3dd6bc5)의 구조를 그대로 축약한 표본 — 소제목·목록·이미지·본문.
SAMPLE = """# 고양이 분리불안 완화, 제대로 알아보기

## 오해부터 풀고 갑니다

고양이를 독립적인 동물이라고만 생각해 오래 집을 비워도 문제가 없다고 여기기 쉽습니다. 하지만 실제로는 보호자가 자리를 비운 사이에 울거나, 화장실을 벗어난 곳에 실수를 하거나, 평소보다 과하게 몸을 핥는 행동이 늘어나는 경우가 적지 않습니다. 이런 신호는 하루아침에 생기는 것이 아니라 여러 날에 걸쳐 조금씩 쌓입니다.

## 핵심만 정리하면

분리불안은 결국 보호자의 부재를 고양이가 어떻게 받아들이느냐의 문제입니다. 사람이 있을 때와 없을 때의 환경 차이가 크면 클수록 불안은 커지고, 익숙한 냄새와 자리처럼 변하지 않는 요소가 남아 있으면 그만큼 안정감을 얻습니다. 그래서 환경을 급격히 바꾸는 것보다 익숙한 것을 남겨두는 편이 효과가 좋습니다.

## 고를 때 봐야 하는 기준

시중에는 방식이 서로 다른 제품이 많아 무엇을 먼저 봐야 할지 헷갈리기 쉽습니다. 아래 기준을 먼저 정해두면 비교가 훨씬 수월해집니다.

- 향이 인위적이지 않고 자연스럽게 오래 유지되는지
- 세탁이나 관리가 쉬워 위생적으로 계속 쓸 수 있는지
- 고양이가 물어뜯거나 긁어도 안전한 소재로 만들어졌는지
- 크기와 형태가 몸을 기대기에 편안한지

이 중에서도 향의 자연스러움이 특히 중요합니다. 인공적인 향이 강하면 오히려 고양이가 거부감을 느껴 가까이 가지 않으려 합니다.

[이미지] 거실 소파 위에 놓인 부드러운 쿠션에 고양이가 몸을 기대고 있는 모습

## 실제로 적용해보는 순서

향을 활용한 제품을 처음 들일 때는 순서를 지켜야 거부감 없이 받아들입니다.

1. 보호자가 자주 쓰는 물건 근처에 쿠션을 두어 향이 자연스럽게 스며들게 한다
2. 고양이가 자주 머무는 창가나 잠자리 근처로 자리를 옮긴다
3. 처음 며칠은 짧은 외출부터 시도하며 반응을 관찰한다
4. 편안한 자세를 보이기 시작하면 외출 시간을 조금씩 늘려간다
5. 세탁 시기를 메모해두고 같은 향을 유지한다

가장 중요한 것은 급하게 진행하지 않는 것입니다. 고양이마다 적응 속도가 다르므로 며칠 만에 큰 변화를 기대하기보다 몇 주를 두고 천천히 지켜보는 편이 좋습니다.
"""

print("[1] 검증 기준이 에디터 카운터와 같은 잣대인가")
visible = measure_visible_char_count(SAMPLE)
comparable = measure_editor_comparable_char_count(SAMPLE)
check("공백 포함 값이 더 크다", visible > comparable, True)
check("표본이 최소 기준(300자)보다 충분히 길다", comparable > 400, True)
# 에디터 카운터가 하는 일: 렌더 텍스트에서 \s+ 를 전부 제거
rendered = []
for raw in SAMPLE.splitlines():
    line = raw.strip()
    if not line or line.startswith("[이미지]"):
        continue
    line = re.sub(r"^#{1,6}\s*", "", line)
    line = re.sub(r"^[\s]*[-*]\s+", "", line)
    rendered.append(line.replace("**", "").replace("`", ""))
editor_perfect = len(re.sub(r"\s+", "", " ".join(rendered)))
check("완벽 입력 시 에디터 값 = 비교용 기준값", comparable, editor_perfect)

print("[2] 완벽하게 입력된 글이 기준을 통과하는가")
old_threshold = max(300, int(visible * 0.75))
new_threshold = max(300, int(comparable * 0.75))
old_margin = editor_perfect - old_threshold
new_margin = editor_perfect - new_threshold
print(f"       옛 기준 {old_threshold} / 새 기준 {new_threshold} / 완벽 입력값 {editor_perfect}")
check("옛 기준은 여유가 10% 미만이었다", old_margin < editor_perfect * 0.10, True)
check("새 기준은 통과", editor_perfect >= new_threshold, True)
check("새 기준 여유 20% 이상", new_margin >= editor_perfect * 0.20, True)

print("[3] 실제로 절반만 들어간 글은 여전히 잡히는가 (회귀)")
half = int(editor_perfect * 0.51)
check("절반 입력은 실패로 잡힘", half < new_threshold, True)

print("[4] 표: 3행 초과분을 버리지 않는다")
src = func_source("_input_table")
check("rows[:3] 로 잘라 버리는 코드 없음", "rows[:3]" in src and "overflow" not in src, False)
check("넘치는 행 처리 존재", "overflow = rows[3:]" in src, True)
check("표 탈출 확인 존재", "_caret_inside" in src, True)
check("탈출 실패 시 폴백 존재", "nextElementSibling" in src, True)

print("[5] 목록: 해제됐는지 확인한다")
src_list = func_source("_input_list")
check("목록 해제 확인 존재", "_caret_inside" in src_list, True)
check("재시도 존재", "재시도" in src_list or "attempt" in src_list, True)

print("[6] 캐럿 확인 헬퍼는 실패 시 None 을 돌려준다")
sig = func_source("_caret_inside")
check("예외 시 None 반환", "return None" in sig, True)
check("호출부가 None 을 별도 처리", "inside is None" in src and "inside is None" in src_list, True)

print("[7] 목록·표에 마크다운 별표가 새지 않는가")
import importlib.util as _il
_spec = _il.spec_from_file_location("markdown_parser", ROOT / "content" / "markdown_parser.py")
_mp = _il.module_from_spec(_spec)
_spec.loader.exec_module(_mp)
plain = lambda t: "".join(x for _, x in _mp._parse_bold(t)).strip()
check("목록 항목 별표 제거", plain("**현금 유동성**: 목돈이 묶이는지"), "현금 유동성: 목돈이 묶이는지")
check("표 칸 별표 제거", plain("**전세보증보험** 가입"), "전세보증보험 가입")
check("별표 없는 문장은 그대로", plain("매달 나가는 대출 이자"), "매달 나가는 대출 이자")
src_list2 = func_source("_input_list")
check("목록이 인라인 정리를 거친다", "_inline_plain" in src_list2, True)
check("표가 인라인 정리를 거친다", "_inline_plain" in src, True)

print("[8] 표 칸을 Tab 이 아니라 클릭으로 채우는가")
check("칸마다 직접 포커스", "_focus_cell" in src, True)
check("DOM 재조회 후 클릭", "find_elements" in src, True)
check("클릭 실패 시 Tab 폴백 유지", "Keys.TAB" in src, True)

print("[9] 검증 수치가 로그·결과에 남는가 (계측)")
APP_SRC = (ROOT / "app.py").read_text(encoding="utf-8")
check("성공 경로에도 입력률 로그", "[검증] 본문 입력" in APP_SRC, True)
check("결과에 input_verification 포함", '"input_verification": {' in APP_SRC, True)
check("변수 기본값 초기화(경로 미진입 대비)", "input_fill_ratio = 0" in APP_SRC, True)

print(f"\n결과: PASS {passed} / FAIL {failed}")
sys.exit(1 if failed else 0)

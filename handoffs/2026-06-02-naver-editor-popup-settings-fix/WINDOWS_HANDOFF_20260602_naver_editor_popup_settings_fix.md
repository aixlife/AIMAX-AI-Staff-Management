# Windows Handoff — 네이버 에디터 작성중-글 팝업 / 로컬설정 무한로딩 수정

- 날짜: 2026-06-02
- 작성: Mac 측 (Claude Code)
- 대상: Windows 측 AI 개발자
- 관련 커밋: `7ae32b0` (branch `fix/naver-editor-popup-and-settings-loop`)
- 첨부 패치: `7ae32b0-naver-editor-popup-settings-fix.patch`

## 1. 배경 / 증상 (CEO 보고 기준)

두 가지 재발 버그를 수정했다.

1. **로컬설정 저장 후 무한 로딩**
   - "AIMAX 로컬설정"을 열고 저장을 누르면 창이 꺼졌다가 곧바로 다시 켜지고,
     커서를 올리면 무한 로딩(beachball)으로 앱이 먹통이 된다. 이전에도 반복됐다.

2. **"작성중인 글이 있습니다" 팝업 취소가 안 눌림 → 제목이 안 써지고 본문부터 써짐**
   - 자동 로그인 후 편집기 진입 직전 작성중 글 팝업이 뜨는데, 자동화가
     취소 버튼을 못 누르고 화면상 본문을 계속 전체 드래그(전체선택)만 반복한다.
   - 결과적으로 제목이 비고 본문부터 써진 것처럼 보인다.

## 2. 근본 원인

### Fix A — 로컬설정 무한로딩 (`app.py`)
- 웹앱이 보낸 `open_settings` 명령은 done 처리 전까지 폴링(`next_command`)마다 계속 재전달된다.
- 설정창은 `self.root.wait_window(dlg)`(중첩 이벤트 루프)+`grab_set()`으로 떠 있는데,
  그 사이 폴링 스레드가 같은 명령을 다시 큐에 넣어 `_handle_web_agent_command`가 재진입 →
  설정창이 위로 계속 쌓인다.
- 저장하면 맨 위 창만 닫히고 밑에 또 있어서 "꺼졌다 다시 켜짐", 중첩된 grab_set/wait_window가
  메인 스레드를 막아 무한 로딩이 된다.
- 재진입 가드도, command_id 중복 처리 방지도 없어서 매번 재발.

### Fix B — 작성중 글 팝업 (`posting/editor.py`)
- `navigate_to_editor`의 취소 처리가 단 1회만 즉시 실행 → 팝업이 살짝 늦게 뜨면 놓친다.
- 팝업이 안 닫힌 채 `input_title`이 돌면 모달이 키보드 입력을 가로채 제목이 허공으로 간다.
  (Mac 검증 1차: 제목이 JS 주입 폴백으로만 "성공"으로 보였고 실제 저장 시 비어 있었음)
- 기존 라벨 기반 클릭(`_click_new_post_from_draft_popup`)은 팝업 밖 엉뚱한 버튼을 눌러
  True를 반환하고도 팝업을 못 닫는 경우가 있었다.

## 3. 변경 내용 (커밋 `7ae32b0`)

### `app.py` (Fix A)
- `__init__`에 가드 상태 추가:
  ```python
  self._local_settings_dialog_open = False
  self._handled_command_ids = set()
  ```
- `_handle_web_agent_command` 진입부에서 `open_settings`만 가드:
  - 같은 `command_id` 재전달 시 무시 (중복 처리 차단)
  - 설정창이 이미 열려 있으면 추가로 안 띄움 (재진입 차단)
  - 처리한 id 집합은 200개 초과 시 100개로 트림
- 설정창 호출을 `try/finally`로 감싸 플래그를 정확히 켜고 끔.
- 다른 잡(songi/import)의 정당한 재시도는 막지 않도록 open_settings에만 한정.

### `posting/editor.py` (Fix B)
- `_dismiss_draft_popup(driver, timeout=8)`: 팝업이 사라질 때까지 최대 8초 폴링 재시도.
  안 닫히면 무한 대기 없이 timeout 후 정직하게 False 반환.
- `_click_draft_cancel(driver)`: **CEO가 캡처해 준 셀렉터를 1순위**로 사용.
  - 1순위: `button.se-popup-button.se-popup-button-cancel`
  - selenium 클릭 + JS 클릭 양쪽 시도, `is_displayed()` false-negative 무시.
  - 라벨 기반 폴백보다 **우선** 시도해 헛클릭 방지.
- `_draft_popup_visible(driver)`: `.se-popup-alert-confirm` / `.se-popup-alert`로 한정.
  generic `.se-popup`까지 잡으면 에디터의 "임시저장" 버튼 텍스트로 오탐하므로 알럿류로 제한.
- `navigate_to_editor`: 단발성 취소 처리 → `_dismiss_draft_popup(driver, timeout=8)` 호출로 교체.

> 이 변경은 모두 크로스플랫폼 순수 파이썬이다. `os.name == "nt"` 분기는 기존 코드에서
> 이미 처리되며 이번 변경은 OS 무관하게 동일하게 동작한다. Windows에서도 그대로 적용된다.

## 4. 적용 방법 (택1)

- **A. 패치 적용**: Windows 작업 폴더(Syncthing 밖 로컬 복사본)에서
  ```
  git apply 7ae32b0-naver-editor-popup-settings-fix.patch
  ```
  또는 동일 저장소면 `git cherry-pick 7ae32b0`.
- **B. 수동 적용**: 위 3장 설명대로 `app.py` 2곳(+`__init__` 1곳), `posting/editor.py` 2곳 반영.

적용 후:
```
python -m py_compile app.py posting\editor.py
```
로 컴파일만 먼저 확인.

## 5. 검증 (no-paid 우선)

### Fix A — 무한로딩 (Naver/유료 불필요, 권장 필수 검증)
1. v 빌드/실행 후 웹 UI에서 로컬설정 열기(open_settings) → 네이버 ID/PW 입력 → 저장.
2. 기대: 저장 후 창이 1회만 닫히고 **다시 안 열림**, 무한 로딩 없음.
3. 추가: 웹에서 open_settings를 짧은 간격으로 2회 보낸 뒤 1번 저장 → 창이 1개만 떠야 함.

### Fix B — 작성중 글 팝업 / 제목 (실제 네이버 편집기 필요)
- 이 수정의 완전 검증은 **실제 네이버 편집기 세션**이 있어야 한다.
- CEO 규칙상 네이버 저장/발행은 무단 금지. **CEO가 자기 계정으로 임시저장 테스트를 명시 승인한 경우에만** 진행.
  - 승인 시: 키워드 1건으로 **임시저장 모드**로 글쓰기 → 편집기 진입 로그에서
    `작성중 팝업 취소 클릭 (selenium, button.se-popup-button.se-popup-button-cancel)` +
    `작성중 글 팝업 닫힘 확인`이 1회로 깔끔히 찍히는지, **제목이 붙여넣기 단계에서 실제로 들어가는지** 확인.
  - 미승인 시: 코드 리뷰 + 컴파일로 갈음하고 결과서에 "Naver 미실행" 명시.

## 6. 주의 / 한계

- 이번 커밋에는 포함되지 않은 **별도 WIP**가 Mac 작업트리에 있다:
  - `posting/editor.py`의 정교한 `input_title`(붙여넣기/타이핑/JS주입 폴백) 재작성은
    이전 세션의 미커밋 WIP이며 이 커밋과 무관하다.
  - 제목 입력 안정성은 (1) 이번 팝업 닫힘 수정 + (2) 그 input_title WIP 조합이 가장 좋다.
  - Windows 작업본에 그 input_title WIP가 없다면, 제목은 더 단순한 기존 경로를 타게 된다.
    팝업 닫힘(이번 수정)이 핵심 원인 해소이지만, 제목 입력 로직 자체의 최신화 여부는 별도 확인 필요.
- `scripts/test_real_draft_write.py`는 실계정 임시저장 흐름을 직접 호출하는 검증 도구다.
  비밀번호는 키체인/안전저장소에서 읽고 코드에 노출하지 않는다. 유료 호출 없음(텍스트 전용).

## 7. 결과 보고 요청

`WINDOWS_RESULT_20260602_naver_editor_popup_settings_fix.md`에 작성:
- 전체 PASS/BLOCKED
- Windows/브라우저/앱 버전
- 컴파일 결과
- Fix A 무한로딩 재현/해결 증거(저장 후 재오픈 없음)
- Fix B: Naver 실행 여부(승인/미승인), 실행 시 팝업 닫힘·제목 입력 로그 증거
- no-paid / no-secrets 명시

# Windows 핸드오프 — Phase B: uv 전환 (setup.bat) 검증

- 날짜: 2026-06-05
- 범위: 소스 설치 경로(`setup.bat`)를 uv 기반으로 전환. pip/venv 폴백 유지.
- macOS(`setup.sh`)는 맥에서 클린 e2e PASS 완료. Windows만 실기기 검증 필요.

## 무엇이 바뀌었나

기존 `setup.bat`: `py -3.12/-3.11/python` 탐색 → `venv` 생성 → `pip install -r requirements.txt`.
이로 인한 실패: Python 미설치/버전 불일치, tkinter(Tcl/Tk) 누락, venv 깨짐, 느린 pip.

신규 `setup.bat`: **경로 A(uv 기본)** → 실패 시 **경로 B(기존 py/venv/pip 폴백)**.

- 경로 A: `uv` 탐색(PATH / `%USERPROFILE%\.local\bin\uv.exe` / `.cargo\bin`) → 없으면
  `powershell irm https://astral.sh/uv/install.ps1 | iex` 로 설치 → `uv sync --frozen`
  (실패 시 `uv sync`) → `uv run python app.py`.
- uv 관리형 Python(python-build-standalone)은 **tkinter 번들 포함** → 별도 Tcl/Tk 설치 불필요.
- uv 설치/sync 어느 단계든 실패하면 `:pip_fallback` 으로 자동 분기(기존 동작 그대로).

신규 파일: `pyproject.toml`, `uv.lock` (전 플랫폼 해석, win32 마커로 pywin32 포함).
`requirements.txt` 는 폴백 경로용으로 유지(현재 pyproject 와 19개 동일).

## 검증 절차 (실기기, 실제 사용자 흐름)

깨끗한 상태에서 시작하는 게 핵심.

1. 사전 정리(클린 시뮬레이션):
   - 프로젝트 폴더의 `venv\`, `.venv\` 폴더 삭제.
   - (선택) uv 미설치 상태 확인: `where uv` → 없음이면 자동설치 경로까지 검증됨.
2. `setup.bat` 더블클릭(또는 cmd 에서 실행).
3. 기대 동작:
   - `[1/3] Checking Chrome... Chrome OK.`
   - `[2/3] Checking uv...` — uv 없으면 powershell 로 설치 후 `uv OK: uv x.x.x`
   - `[3/3] Setting up Python and packages...` — 최초 1~3분(관리형 Python 다운로드 + 패키지)
   - `Setup complete! Starting NaverBlogAuto...` → **앱 GUI 정상 기동**
4. 핵심 점검:
   - GUI 가 떠야 함(= tkinter 정상 = 관리형 Python 번들 Tk 동작).
   - 앱에서 네이버 로그인/발행 1회 정상 동작(회귀 없음).
   - `.venv\` 가 생성됐는지 확인(uv 경로 성공 표식). `venv\`(구 폴백)는 안 생겨야 정상.
5. 폴백 검증(선택, 권장):
   - 인터넷 차단 등으로 uv 설치를 일부러 실패시켜 `:pip_fallback` 분기가 기존대로 동작하는지.

## 의존성 import 점검 (맥에서 이미 PASS — 윈도우 재확인)

```
uv run python -c "import tkinter, selenium, undetected_chromedriver, keyring, google.genai, anthropic, pandas, openpyxl, yaml, PIL, pyperclip, win32clipboard; print('ALL OK')"
```

Windows 에서는 `win32clipboard`(pywin32) 도 import 돼야 함(클립보드 이미지 업로드).

## 결과 회신 양식

- uv 설치: 자동 / 이미있음 / 실패→폴백
- uv sync 소요: __초
- GUI 기동: PASS / FAIL(메시지)
- 네이버 발행 1회: PASS / FAIL
- 폴백 경로: 미테스트 / PASS / FAIL

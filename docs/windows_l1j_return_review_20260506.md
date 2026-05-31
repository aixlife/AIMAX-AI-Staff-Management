# Windows L1J Return Review 2026-05-06

## 확인한 Syncthing 반환 폴더

`/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/AIMAX-L1J-20260506`

## 반환물

- `AIMAX-L1J-Windows-installers-20260506.zip`
- `AIMAX-L1J-Windows-final-package-20260506/aimax-bundle-windows.exe`
- `AIMAX-L1J-Windows-final-package-20260506/aimax-yeri-windows.exe`
- `AIMAX-L1J-Windows-final-package-20260506/aimax-hyunju-windows.exe`
- `AIMAX-L1J-Windows-final-package-20260506/windows-l1j-source-delta-20260506.patch`
- `AIMAX-L1J-Windows-final-package-20260506/WINDOWS_L1J_COMPLETION_REPORT_20260506.md`
- `AIMAX-L1J-Windows-final-package-20260506/mac_apply_protocol_connect_20260506.md`
- `AIMAX-L1J-Windows-final-package-20260506/server_app_html_with_launch_button_20260506.html`

## 무결성 확인

Windows에서 생성된 SHA 파일은 CRLF 때문에 macOS `shasum -c`가 파일명 끝의 CR 문자를 포함해 읽어서 실패했다. 직접 계산한 SHA는 보고서와 일치한다.

- ZIP: `e6fdd64be5b1b3223caeb6c827140c3d67be354b7807c895108184f244264133`
- Bundle EXE: `1a76850571cc76357ff6462d0c83d416d321cc77a5196112f1b124b4a64b82f4`
- Yeri EXE: `b027f6c202828b880e835a55873e9b33213508bf43896660f6662c67635072bd`
- Hyunju EXE: `679b944f54bf4068b2ff77a1d5987a298249b266b45e0900bc6871a6d6046fae`

## 보안 확인

반환 폴더와 최종 ZIP 목록 기준으로 평문 `.env`, passphrase, secret, token, key 파일은 추가되지 않았다.

## Windows 보고서 핵심 결과

- `scripts/headless_agent_polling_smoke.py` 통과
- `scripts/agent_heartbeat_only_smoke.py` 통과
- 실제 웹/Naver 저장 테스트 성공
- 테스트 키워드: `바이브코딩`
- 모델: `gpt-5-mini`
- 목표 글자수: 800자
- 결과 글자수: 825자
- 이미지: OpenAI 1개
- 총 비용: 70원
- Windows 설치 후 `aimax://agent/connect` 실행으로 설치된 AIMAX 실행기 기동 확인
- Startup 자동 실행 바로가기는 남기지 않음

## Mac 소스에 반영한 항목

- `oracle/aimax-reports-api/static/app.html`
  - 연결이 끊긴 상태에서 누를 수 있는 `실행기 연결` 버튼 추가
  - `aimax://agent/connect` 호출 추가
  - 로컬 설정 열기 시 실행기가 꺼져 있으면 연결 요청으로 전환
- `local_agent/runtime.py`
  - 첫 실행 웹앱 연결 창 추가
  - 웹앱 로그인 성공 후 로컬 보안 설정 창으로 이어지는 흐름 추가
  - headless 출력의 Unicode 안전 처리 추가
- `app.py`, `split_version/app.py`
  - 프로토콜 URL 인자가 들어와도 깨지지 않도록 `parse_known_args()` 적용
- `browser/human_actions.py`
  - Windows 에디터 클릭 안정화를 위해 scroll/fallback click 추가
- `content/ai_text.py`
  - 글자수 보정 재작성 지시 강화
  - 글자수 보정 재시도 2회에서 4회로 확대
- `packaging/windows/aimax_installer.iss`
  - `aimax://` URL protocol 등록
  - 과거 Startup 자동 실행 바로가기 제거

## 로컬 검증

- `./venv/bin/python -m py_compile app.py split_version/app.py local_agent/runtime.py browser/human_actions.py content/ai_text.py web_agent/client.py`: 통과
- `oracle/aimax-reports-api/static/app.html` inline JS syntax check: 통과

## 남은 운영 작업

1. 운영 서버의 Windows 설치 파일 3개를 반환 EXE로 교체한다.
2. 운영 웹앱 `oracle/aimax-reports-api/static/app.html`을 배포해야 대시보드에 `실행기 연결` 버튼이 실제로 보인다.
3. macOS 앱에서도 웹앱 버튼으로 앱을 깨우려면 macOS 패키징에 `aimax://` URL scheme 등록을 별도 반영해야 한다.
4. 운영 반영 후 실제 대시보드에서 다운로드, 연결 버튼, 로컬 설정 열기, heartbeat 연결 상태를 다시 확인한다.

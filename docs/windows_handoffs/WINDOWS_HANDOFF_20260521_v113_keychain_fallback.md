# Windows Handoff 20260521 v1.0.13 Credential Fallback

## 목적

macOS에서 확인된 실행기 연결 문제를 Windows 통합 실행기에도 같은 관점으로 점검하고, 필요 시 Windows `v1.0.13` 후보로 반영합니다.

이번 원인:
- macOS 실행기 연결 시 `invalid_credentials`는 실제 서버 로그인 거절입니다. 입력값 앞뒤 공백도 같은 오류로 보일 수 있어 실행기에서 비밀번호 입력값을 `strip()` 처리하도록 보강했습니다.
- macOS 키체인 팝업이 여러 번 뜬 이유는 실행기 시작/연결 중 네이버 비밀번호, Gemini/OpenAI/Claude/Apify 키 등 여러 비밀값을 키체인에서 각각 읽기 때문입니다.
- 키체인을 거부하거나 잠긴 환경에서는 세션/설정이 저장되지 않아 다음 실행 때 다시 연결창과 키체인 팝업이 반복될 수 있습니다.

## Mac에서 이미 반영한 변경

- `web_agent/client.py`
  - 웹앱 세션 토큰을 키체인뿐 아니라 `APP_DATA_DIR/.web_agent_session.json`에도 `0600` 권한으로 저장.
  - 로드 순서: fallback 파일 우선, 없으면 키체인.
  - `AIMAX_DISABLE_KEYCHAIN` 환경에서는 키체인 접근 없이 fallback만 사용.

- `app.py`, `split_version/app.py`
  - 일반 설정 비밀값 fallback 추가: `APP_DATA_DIR/.settings_secrets.json`, `0600`.
  - 설정 저장 시 네이버 비밀번호/API 키를 fallback에도 저장.
  - 설정 로드 시 fallback 우선, 없으면 키체인/legacy 키체인에서 1회 마이그레이션.
  - 키체인 접근이 timeout/deny/error이면 `settings.json`에 `keychain_unavailable=true`를 기록해 반복 팝업을 줄임.
  - macOS는 기본적으로 키체인 자동 접근을 하지 않고 `AIMAX_ENABLE_KEYCHAIN=1`일 때만 키체인을 사용.
  - 웹앱 비밀번호 입력값 앞뒤 공백 제거.

- `local_agent/runtime.py`
  - 첫 연결창의 웹앱 비밀번호 입력값 앞뒤 공백 제거.

- `web_agent/client.py`
  - `invalid_credentials` 한국어 안내에 “복사한 값 앞뒤 공백” 힌트 추가.

## Windows 작업 지시

1. 최신 Windows 작업 폴더가 Git checkout인지 먼저 확인하세요.
   - Git checkout이면 `git status`, `git diff`로 기존 v1.0.12 변경과 충돌 여부를 확인합니다.
   - Git checkout이 아니면 push 포함 여부를 단정하지 말고 completion report에 명시합니다.

2. 이 handoff의 `source_delta/` 파일을 참고하되, Windows 런타임 버전은 `v1.0.13`으로 맞추세요.
   - Mac source의 `APP_VERSION=v1.0.6`을 그대로 Windows에 가져가면 안 됩니다.
   - Windows 현재 운영 최신은 `v1.0.12`입니다.

3. 반드시 보존할 기존 Windows v1.0.12 수정:
   - `input_content() got an unexpected keyword argument 'image_provider'` 수정.
   - v1.0.11/v1.0.12에서 통과한 editor image provider contract.
   - 통합 실행기 파일명/권한/worker readiness 정책.

4. Windows Credential Manager가 정상인 환경과 실패/비활성 환경을 모두 no-paid 방식으로 확인하세요.
   - 실제 Naver 발행/저장 금지.
   - 유료 AI API 호출 금지.
   - 실제 고객 데이터, API 키, 쿠키, 브라우저 프로필, raw private logs 사용 금지.

## 권장 검증

- `python -m py_compile web_agent/client.py app.py split_version/app.py local_agent/runtime.py`
- `AIMAX_DISABLE_KEYCHAIN=1` 또는 Windows equivalent 환경에서:
  - `save_session_token("dummy")` 후 `load_session_token()`이 fallback으로 복구되는지 확인.
  - `save_settings(...)` 후 `load_settings()`가 fallback으로 네이버/API 설정을 복구하는지 확인.
  - fallback 파일 권한/위치가 사용자 데이터 폴더 안인지 확인.
- mocked login 실패:
  - `invalid_credentials`가 영어 코드만 보이지 않고 한국어 안내로 보이는지 확인.
  - 비밀번호 앞뒤 공백이 제거되는지 확인.
- mocked token-save failure:
  - 로그인 성공 후 안전 저장소 실패가 전체 로그인 실패로 보이지 않는지 확인.
- 기존 v1.0.12 editor/image 검증 유지:
  - `scripts/verify_editor_image_provider_contract.py`가 있으면 실행.

## 반환 요청

공유 폴더에 아래를 반환해주세요.

- `WINDOWS_COMPLETION_20260521_v113_keychain_fallback.md`
- 빌드했다면 `aimax-bundle-windows.exe`와 `SHA256SUMS.txt`
- 변경 파일 목록
- 통과/실패 테스트 로그 요약
- Windows에 배포해도 되는지 판정: `pass`, `block`, `unclear`

판정이 `unclear`인 경우 실제 배포/푸시를 막고 이유를 적어주세요.

# WINDOWS_HANDOFF_20260523_cross_platform_local_settings

작성 시각: 2026-05-23 KST

## 목적

Mac에서 보인 문제를 Mac만의 문제로 처리하지 말고, Windows 실행기에서도 같은 계정/플랫폼/설정 흐름이 안정적인지 확인한다.

이번 문제의 핵심은 두 가지다.

- 같은 계정에서 Mac과 Windows 실행기를 함께 쓸 때 서버가 `user_id` 기준으로만 실행기 상태를 저장해 플랫폼 상태가 섞일 수 있었다.
- 웹 대시보드의 `로컬 설정 열기`가 사용자에게 네이버 설정과 AI/API 키 설정을 한 창에 보여줘, 송이 웹 키/블로그팀 로컬 키의 경계가 혼동됐다.

## Mac/Server에서 완료된 내용

- Oracle web/server 배포 완료.
- Mac 통합 설치본 `v1.0.10` 빌드 및 배포 완료.
- macOS 최신/최소 버전은 `v1.0.10`.
- Windows 최신/최소 버전은 건드리지 않았고 `v1.0.16` 유지.
- 공개 version API 확인:
  - macOS `v1.0.9` -> `v1.0.10` required
  - macOS `v1.0.10` -> latest
  - Windows `v1.0.15` -> `v1.0.16` required

## Windows에서 확인할 것

1. 현재 Windows 설치본 `v1.0.16`으로 같은 계정에서 Mac 상태가 섞이지 않는지 확인한다.
   - Windows 브라우저의 업데이트 화면은 Windows 기준 `v1.0.16`이어야 한다.
   - Mac 릴리즈노트나 Mac `v1.0.10` 필수 업데이트 문구가 Windows에 뜨면 안 된다.

2. `로컬 설정 열기` UX를 확인한다.
   - 웹 대시보드에서 로컬 설정 열기를 눌렀을 때 Windows 실행기 창이 빠르게 반응해야 한다.
   - 사용자에게 보여주는 창은 네이버 ID/비밀번호 중심이어야 한다.
   - Gemini/Claude/OpenAI/Apify 입력칸이 웹에서 열린 로컬 보안 설정창에 노출되면 이번 기준에서는 미반영이다.
   - 기존 로컬 AI/API 키는 삭제되면 안 된다.

3. 명령 라우팅을 확인한다.
   - Mac 대상 `open_settings` 명령을 Windows 실행기가 받아 처리하면 안 된다.
   - Windows 대상 `open_settings` 명령은 Windows 실행기가 받아야 한다.
   - 같은 계정으로 Mac/Windows가 번갈아 heartbeat해도 `/api/agent/status?platform=windows` 결과가 Windows 실행기여야 한다.

4. 다운로드/업데이트 흐름을 확인한다.
   - Windows 설치 파일은 기존 `aimax-bundle-windows.exe` `v1.0.16` 기준이어야 한다.
   - 이번 Mac DMG 배포로 Windows 다운로드 파일이나 Windows 버전값이 바뀌면 안 된다.

## 필요 시 반영할 소스

Mac 쪽에서 수정한 공통 소스 묶음을 함께 전달한다.

- `source-tree-cross-platform-local-settings-20260523.zip`
- SHA256: `6874d1aad453d9cd084015e76c3feaaf34014fa52674322a8272329f7e7ccec3`

포함 파일:

- `app.py`
- `split_version/app.py`
- `local_agent/runtime.py`
- `web_agent/client.py`
- `oracle/aimax-reports-api/server.js`
- `oracle/aimax-reports-api/static/app.html`
- `scripts/smoke_local_secret_import.mjs`

주의:

- `aimax_compliance.py`와 `split_version/aimax_compliance.py`는 포함하지 않았다. Mac은 `v1.0.10`, Windows는 현재 `v1.0.16`이므로 Mac 버전값으로 Windows를 낮추면 안 된다.
- Windows에 이 변경을 반영해 재빌드가 필요하면 Windows 다음 버전은 `v1.0.17`로 올리는 쪽을 권장한다.
- Syncthing 폴더에서 직접 빌드하지 말고 로컬 작업 폴더로 복사해서 작업한다.

## 무비용 검증 기준

유료 AI, Apify Actor, 실제 Naver 저장/발행은 실행하지 않는다.

필수:

- `python -m py_compile .\app.py .\split_version\app.py .\local_agent\runtime.py .\web_agent\client.py`
- `node --check .\oracle\aimax-reports-api\server.js`
- app.html embedded script syntax check
- 기존 Windows 검증:
  - `verify_v113_login_ime_guard.py`
  - `verify_v114_local_settings_ux.py`
  - `verify_v110_no_paid_editor_smoke.py`
- 가능하면 `scripts\smoke_local_secret_import.mjs`를 Windows 로컬에서 실행하거나 동일한 no-paid inline smoke로 대체한다.

추가 확인:

- packaged/frozen diagnostics에서 버전이 Windows 기준으로 유지되는지 확인한다.
- `dist\AIMAX\oracle\aimax-reports-api\static\app.html`에 platform agent status call과 AI/API 연결 안내가 포함되어 있는지 확인한다.
- 웹에서 열린 로컬 설정창이 네이버 ID/비밀번호 중심으로 보이는지 수동 확인한다.

## 반환 요청

공유 폴더에 다음을 남겨주세요.

- `WINDOWS_COMPLETION_20260523_cross_platform_local_settings.md`
- 필요한 경우 새 설치본 `aimax-bundle-windows.exe`
- 산출물 SHA256
- 실행한 검증 명령과 결과
- 재빌드가 필요 없다고 판단한 경우 그 근거
- 남은 리스크

## 판정 기준

- Windows `v1.0.16`이 이미 기준을 만족하면 재빌드 없이 `검증 완료`로 반환한다.
- 웹에서 열린 로컬 설정창이 여전히 AI/API 입력칸을 보여주거나 플랫폼 명령 라우팅이 불안하면 `v1.0.17` 재빌드가 필요하다.

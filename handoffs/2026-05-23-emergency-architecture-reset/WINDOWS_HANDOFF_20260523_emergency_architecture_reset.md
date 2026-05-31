# Windows Handoff 2026-05-23 - Emergency Architecture Reset

## 목적

현재 AIMAX는 개별 기능 추가보다 운영 안정화가 우선입니다.

Windows v1.0.17에서도 예리 작업이 `로컬 실행기의 네이버 계정 또는 AI API Key 필요`로 실패한 보고가 올라왔습니다. 또한 설정 저장 후 기존 API 키가 사라지는 경험, 로컬 설정 열기/저장 후 무한 로딩, 송이/윤미/직원 노출 혼선이 같이 발생했습니다.

이번 Windows 작업은 신규 기능 추가가 아니라 **응급 안정화 rebuild + 구조 점검**입니다.

## 먼저 읽을 문서

1. `docs/maintenance_reports/aimax_architecture_reset_20260523.md`
2. 이 문서
3. `WINDOWS_AI_COPYPASTE_PROMPT_20260523_emergency_architecture_reset.md`

Shared-Bridge에는 구조 보고서 사본 `aimax_architecture_reset_20260523.md`도 함께 넣어두었습니다.

## 적용할 소스

같은 폴더의 `source-files-emergency-architecture-reset-20260523.zip`를 Windows 로컬 작업 폴더에 풀어서 적용해주세요.

포함 파일:

- `app.py`
- `split_version/app.py`
- `local_agent/runtime.py`
- `local_agent/single_instance.py`
- `oracle/aimax-reports-api/static/app.html`
- `scripts/smoke_local_settings_preserve_secrets.py`
- `scripts/ops_snapshot_sanitized.py`
- `docs/maintenance_reports/aimax_architecture_reset_20260523.md`

## 핵심 수정 의도

- 로컬 설정 창에서 빈 API 키 입력칸을 저장해도 기존 provider key를 삭제하지 않습니다.
- 웹에서 여는 로컬 보안 설정은 Naver/local 설정만 저장하고 Gemini/OpenAI/Claude/Apify 키를 건드리지 않습니다.
- 이전 버그로 생긴 provider clear marker를 로드 시 복구합니다.
- `aimax://agent/open-settings` 또는 중복 실행 시 기존 실행기 인스턴스에 요청을 남기는 signaling을 복구합니다.
- 웹 `로컬 설정 열기`는 전달됨 상태만 보고 끝내지 않고 완료/실패/timeout을 기다리며, timeout이면 자동 오류 보고가 올라가게 합니다.

## Windows 작업 범위

1. 공유 폴더에서 직접 빌드하지 말고 로컬 Windows 작업 폴더에 복사 후 진행합니다.
2. 현재 Windows 배포가 v1.0.17이면 다음 Windows 빌드는 v1.0.18로 올려주세요.
3. Songi는 web-first입니다. 송이를 local-agent-required로 바꾸지 마세요.
4. Yunmi는 web module입니다. admin/권한 구조는 이번 rebuild에서 임의로 확장하지 말고, 현재 contract가 깨지지 않는지만 확인해주세요.
5. Naver 실제 발행/임시저장, 유료 AI/API, Apify Actor는 실행하지 마세요.

## 필수 검증

No-paid checks:

- Python compile:
  - `app.py`
  - `split_version/app.py`
  - `local_agent/runtime.py`
  - `local_agent/single_instance.py`
  - `web_agent/client.py`
  - `scripts/smoke_local_settings_preserve_secrets.py`
  - `scripts/headless_agent_polling_smoke.py`
- Server syntax:
  - `node --check oracle\aimax-reports-api\server.js`
- Web static:
  - embedded `<script>` syntax check for `oracle\aimax-reports-api\static\app.html`
- Smoke:
  - `LOCAL_SETTINGS_PRESERVE_SECRETS_OK`
  - `LOCAL_SECRET_IMPORT_SMOKE_OK`
  - `YUNMI_ACCESS_GATE_SMOKE_OK`
  - headless agent polling smoke with fake jobs
- If existing Windows no-paid editor smoke exists, run it too.

Installed Windows smoke:

- vNext installer installs and opens.
- `aimax://agent/connect` connects to web.
- `aimax://agent/open-settings` opens the existing running agent's settings window.
- Local settings save with fake/placeholder provider keys already present does not clear those keys.
- Password/API input IME guard still works.
- The settings window does not close/reopen into a web-side infinite loading state.

## 반환물

공유 폴더에 아래를 남겨주세요.

- `WINDOWS_COMPLETION_20260523_emergency_architecture_reset.md`
- 새 installer artifact path
- SHA-256
- 전체 smoke output 요약
- 실패/차단 항목
- Songi/Yunmi/Blog Team이 이번 rebuild에 영향을 받았는지 여부

## 판정 기준

- 위 검증이 끝나기 전에는 배포 가능으로 판정하지 않습니다.
- provider key 보존 검증이 실패하면 rebuild를 배포하지 않습니다.
- protocol open-settings가 기존 실행기에 신호를 주지 못하면 rebuild를 배포하지 않습니다.

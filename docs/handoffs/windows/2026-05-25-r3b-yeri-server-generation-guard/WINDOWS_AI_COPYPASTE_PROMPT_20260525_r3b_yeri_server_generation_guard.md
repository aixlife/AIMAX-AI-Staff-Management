아래 작업을 Windows Codex 환경에서 진행해주세요.

먼저 공유 폴더의 최신 handoff를 읽으세요:

`20_Deploy-To-Windows\2026-05-25-r3b-yeri-server-generation-guard\WINDOWS_HANDOFF_20260525_r3b_yeri_server_generation_guard.md`

목표:

- R3-B 예리 Hybrid 서버 생성 가드가 Windows에서도 깨지지 않는지 검증합니다.
- 실제 유료 AI 호출, Apify, Naver 로그인/저장/발행은 절대 실행하지 않습니다.
- Windows 설치본 재빌드는 예상상 필요 없습니다. 필요한지 여부만 판단해서 보고해주세요.

작업 순서:

1. 공유 폴더의 ZIP을 Windows 로컬 작업 폴더로 복사하세요.
   - ZIP: `aimax_r3b_yeri_server_generation_guard_source_bundle_20260525.zip`
   - 공유 폴더 안에서 빌드/테스트하지 말고, 반드시 로컬 작업 폴더에서 실행하세요.

2. ZIP을 풀어 현재 Windows AIMAX 작업 폴더에 overlay 적용하세요.
   - `.env`, API 키, 브라우저 프로필, 쿠키, signed URL, 원문 고객 데이터는 공유 폴더에 넣지 마세요.

3. 아래 검증을 실행하세요.

```powershell
node --check oracle\aimax-reports-api\server.js
node --check scripts\smoke_yeri_server_generation_mock.mjs
node --check scripts\smoke_yeri_paid_generation_guard.mjs
node --check scripts\smoke_yeri_hybrid_foundation.mjs
node --check scripts\smoke_yeri_hybrid_retry_api.mjs
node --check scripts\smoke_job_platform_targeting.mjs
python -m py_compile app.py split_version\app.py web_agent\client.py

node scripts\smoke_yeri_hybrid_foundation.mjs
node scripts\smoke_yeri_server_generation_mock.mjs
node scripts\smoke_yeri_paid_generation_guard.mjs
node scripts\smoke_yeri_hybrid_retry_api.mjs
node scripts\smoke_job_platform_targeting.mjs
node scripts\smoke_worker_catalog_contract.mjs
node scripts\smoke_json_storage_safety.mjs
node scripts\smoke_yunmi_access_gate.mjs
```

반드시 확인할 것:

- `YERI_SERVER_GENERATION_MOCK_SMOKE_OK`
- `YERI_PAID_GENERATION_GUARD_SMOKE_OK`
- `ready_for_publish`가 아직 agent에 claim되지 않는지
- `AIMAX_YERI_SERVER_GENERATION_ENABLED=1` 상태에서도 `confirm_paid=true` 없이는 `yeri_paid_confirmation_required`로 차단되는지
- Windows 경로에서 `fileURLToPath(import.meta.url)` 관련 문제가 없는지

완료 후 공유 폴더에 아래 파일을 반환해주세요:

`WINDOWS_RESULT_20260525_r3b_yeri_server_generation_guard.md`

보고서에는 다음을 포함해주세요:

- verdict: `pass` / `blocked` / `fail`
- Windows OS / Node / Python 버전
- 실행한 명령과 핵심 출력
- paid/no-mutation 준수 여부
- Windows 재빌드 필요 여부
- blocker가 있으면 정확한 파일/증상/수정 제안

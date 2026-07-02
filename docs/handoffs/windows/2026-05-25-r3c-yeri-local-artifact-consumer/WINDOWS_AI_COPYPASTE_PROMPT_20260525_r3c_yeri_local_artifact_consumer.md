아래 작업을 Windows Codex 환경에서 진행해주세요.

먼저 공유 폴더의 handoff를 읽으세요:

`20_Deploy-To-Windows\2026-05-25-r3c-yeri-local-artifact-consumer\WINDOWS_HANDOFF_20260525_r3c_yeri_local_artifact_consumer.md`

목표:

- R3-C 예리 Hybrid 로컬 artifact 소비 기능을 Windows에서 검증합니다.
- `ready_for_publish` job이 artifact를 포함하면 로컬 실행기는 AI 글 생성 없이 마크다운 파싱/네이버 입력 단계로 넘어갈 준비가 되어야 합니다.
- 실제 유료 AI 호출, Apify, Naver 로그인/저장/발행은 절대 실행하지 않습니다.

작업 순서:

1. 공유 폴더의 ZIP을 Windows 로컬 작업 폴더로 복사하세요.
   - ZIP: `aimax_r3c_yeri_local_artifact_consumer_source_bundle_20260525.zip`
   - 공유 폴더 안에서 빌드/테스트하지 말고, 반드시 로컬 작업 폴더에서 실행하세요.

2. ZIP을 풀어 현재 Windows AIMAX 작업 폴더에 overlay 적용하세요.

3. 아래 검증을 실행하세요.

```powershell
node --check oracle\aimax-reports-api\server.js
node --check scripts\smoke_yeri_ready_claim_gate.mjs
node --check scripts\smoke_yeri_server_generation_mock.mjs
node --check scripts\smoke_yeri_paid_generation_guard.mjs
node --check scripts\smoke_yeri_hybrid_foundation.mjs
node --check scripts\smoke_yeri_hybrid_retry_api.mjs
node --check scripts\smoke_job_platform_targeting.mjs
python -m py_compile app.py split_version\app.py web_agent\client.py scripts\smoke_yeri_local_artifact_contract.py

python scripts\smoke_yeri_local_artifact_contract.py
node scripts\smoke_yeri_hybrid_foundation.mjs
node scripts\smoke_yeri_server_generation_mock.mjs
node scripts\smoke_yeri_paid_generation_guard.mjs
node scripts\smoke_yeri_ready_claim_gate.mjs
node scripts\smoke_yeri_hybrid_retry_api.mjs
node scripts\smoke_job_platform_targeting.mjs
node scripts\smoke_worker_catalog_contract.mjs
node scripts\smoke_json_storage_safety.mjs
node scripts\smoke_yunmi_access_gate.mjs
```

반드시 확인할 것:

- `YERI_LOCAL_ARTIFACT_CONTRACT_SMOKE_OK`
- `YERI_READY_CLAIM_GATE_SMOKE_OK`
- `ready_for_publish`는 flag off에서는 미전달, `AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED=1`일 때만 전달
- 전달된 job에 `artifact.content_markdown`이 포함되는지
- local runner가 artifact job에서 `generate_blog_content()`를 건너뛰도록 코드 계약이 반영됐는지
- Windows installer rebuild가 필요한지 판단하세요. 예상은 `필요`입니다.

완료 후 공유 폴더에 아래 파일을 반환해주세요:

`WINDOWS_RESULT_20260525_r3c_yeri_local_artifact_consumer.md`

보고서에는 다음을 포함해주세요:

- verdict: `pass` / `blocked` / `fail`
- Windows OS / Node / Python 버전
- 실행한 명령과 핵심 출력
- paid/no-mutation 준수 여부
- Windows 재빌드 필요 여부
- 재빌드했다면 파일명/크기/SHA256
- blocker가 있으면 정확한 파일/증상/수정 제안

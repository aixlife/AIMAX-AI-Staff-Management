당신은 AIMAX Windows Codex 개발자입니다.

목표:
R3-A 예리 Hybrid Foundation 서버 변경이 Windows 실행기 흐름을 깨지 않는지 확인해주세요. 이번 작업은 Windows 설치본 재빌드가 아니라 **live 서버 계약 변경에 대한 Windows 회귀 검증**입니다.

먼저 읽을 문서:
1. `WINDOWS_HANDOFF_20260525_r3a_yeri_hybrid_foundation.md`
2. 가능하면 `docs/maintenance_reports/aimax_r3a_yeri_hybrid_foundation_20260525.md`

중요 배경:
- Oracle live web 배포는 완료됐습니다.
- remote `server.js` sha256은 `79a0794163705eeaf2527d7b2eaed9cb3a5f921ba9fd9257ce65868cf79bf6dd`입니다.
- 새 서버 상태 계약은 `generating`, `ready_for_publish`입니다.
- 새 retry API는 `POST /api/jobs/:id/retry`입니다.
- R3-A에서는 구버전 실행기 보호를 위해 `/api/agent/next-job`가 아직 `ready_for_publish`를 claim하지 않아야 합니다.

작업 규칙:
- Syncthing 공유 폴더 안에서 빌드/테스트하지 말고, 반드시 로컬 Windows 작업 폴더로 복사해서 확인하세요.
- 고객 데이터, API 키, 쿠키, `.env`, 브라우저 프로필, signed URL, raw private log를 공유 폴더에 넣지 마세요.
- 유료 Gemini/OpenAI/Claude/Apify 호출 금지.
- 네이버 저장/발행/실제 로그인 자동화 금지.

검증해 주세요:
1. `node --check oracle\aimax-reports-api\server.js`
2. `node --check scripts\smoke_yeri_hybrid_foundation.mjs`
3. `node --check scripts\smoke_yeri_hybrid_retry_api.mjs`
4. `node scripts\smoke_yeri_hybrid_foundation.mjs`
5. `node scripts\smoke_yeri_hybrid_retry_api.mjs`
6. `node scripts\smoke_worker_catalog_contract.mjs`
7. `node scripts\smoke_job_platform_targeting.mjs`
8. `python -m py_compile app.py split_version\app.py web_agent\client.py`
9. live health:
   - `Invoke-RestMethod https://api.aimax.ai.kr/api/reports/health`
   - `Invoke-RestMethod https://api.aimax.ai.kr/api/workers`

특히 확인할 것:
- Windows 실행기가 기존 `queued` job을 계속 정상 claim하는가?
- `ready_for_publish` 상태 job은 R3-B 전까지 Windows 실행기가 가져가지 않는가?
- `/api/workers` catalog의 `songi_research`가 여전히 `web_module/research_api/queue=false`인가?
- 신규 public job 필드(`failed_stage`, `failed_reason`, `retry_count`, `artifact`)가 Windows 코드 파싱을 깨지 않는가?
- Windows 설치본 재빌드가 필요한 변경인지 아닌지 판단.

운영 원칙:
- 앞으로 사용자에게 보이는 기능 변경은 Mac 실사용 smoke와 Windows 실사용 smoke를 모두 통과해야 완료/배포 완료로 봅니다.
- 이번 R3-A는 서버 기반/계약 준비 작업이고 `ready_for_publish`가 아직 agent claim 대상이 아니므로 선배포된 예외입니다.
- 그래서 이번 검증의 핵심은 “기존 Windows 사용자가 새 서버 때문에 깨지지 않는가”입니다.

반환 파일:
공유 폴더에 `WINDOWS_RESULT_20260525_r3a_yeri_hybrid_foundation.md`를 작성해주세요.

반환 파일 형식:

```md
# WINDOWS_RESULT_20260525_r3a_yeri_hybrid_foundation

verdict: pass | blocked

## Summary
- ...

## Commands
- command: ...
  result: pass | fail
  note: ...

## Windows Rebuild
- required: yes | no
- reason: ...

## Queue Compatibility
- queued job claim: pass | fail
- ready_for_publish non-claim: pass | fail

## Live Checks
- health: ...
- workers: ...

## Risks
- ...

## No-Paid Confirmation
- Paid API / Apify / Naver save-publish was not called.
```

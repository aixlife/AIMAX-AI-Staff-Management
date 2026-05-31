당신은 AIMAX Windows Codex 개발자입니다.

R3-A 1차 Windows 결과가 `blocked`였던 이유는 Windows 로컬 작업 폴더에 최신 R3-A source/smoke snapshot이 없었기 때문입니다. 이번에는 제공된 source bundle로 다시 검증해주세요.

먼저 읽기:
1. `WINDOWS_RESULT_20260525_r3a_yeri_hybrid_foundation.md`
2. `WINDOWS_ADDENDUM_20260525_r3a_source_bundle.md`
3. 기존 `WINDOWS_HANDOFF_20260525_r3a_yeri_hybrid_foundation.md`

사용할 파일:
- `aimax_r3a_yeri_hybrid_foundation_source_bundle_20260525.zip`
- SHA256: `4328cd26cbc399c15e8573d93bbc2cff08e8e3e1ad1e33ba09a621e60a79d7d7`

작업 규칙:
- shared folder 안에서 실행하지 말고, 반드시 Windows 로컬 임시 폴더로 zip을 복사/해제해서 실행하세요.
- 기존 오래된 `C:\Users\likim\Desktop\NaverBlogAuto-main-wincheck`에 덮어쓰지 말고, 가능하면 새 폴더를 사용하세요.
- 고객 데이터, API 키, 쿠키, `.env`, 브라우저 프로필, signed URL, raw private log를 공유 폴더에 넣지 마세요.
- 유료 Gemini/OpenAI/Claude/Apify 호출 금지.
- 네이버 저장/발행/실제 로그인 자동화 금지.
- production job mutation 금지.

검증:

```powershell
node --check oracle\aimax-reports-api\server.js
node --check scripts\smoke_yeri_hybrid_foundation.mjs
node --check scripts\smoke_yeri_hybrid_retry_api.mjs
node scripts\smoke_yeri_hybrid_foundation.mjs
node scripts\smoke_yeri_hybrid_retry_api.mjs
node scripts\smoke_worker_catalog_contract.mjs
node scripts\smoke_job_platform_targeting.mjs
python -m py_compile app.py split_version\app.py web_agent\client.py
```

Live read-only 확인:

```powershell
Invoke-RestMethod https://api.aimax.ai.kr/api/reports/health
Invoke-RestMethod https://api.aimax.ai.kr/api/workers
```

반드시 확인할 것:
- bundled `oracle\aimax-reports-api\server.js` sha256이 `79a0794163705eeaf2527d7b2eaed9cb3a5f921ba9fd9257ce65868cf79bf6dd`인지
- `YERI_HYBRID_FOUNDATION_SMOKE_OK`
- `YERI_HYBRID_RETRY_API_SMOKE_OK`
- `WORKER_CATALOG_CONTRACT_SMOKE_OK`
- `JOB_PLATFORM_TARGETING_SMOKE_OK`
- Windows 설치본 재빌드가 필요한지 여부. 현재 예상은 `no`.

반환 파일:
- `WINDOWS_RESULT_20260525_r3a_yeri_hybrid_foundation_RECHECK.md`

반환 형식:

```md
# WINDOWS_RESULT_20260525_r3a_yeri_hybrid_foundation_RECHECK

verdict: pass | blocked

## Source Bundle
- zip sha256:
- server.js sha256:

## Commands
- command:
  result:
  note:

## Queue Compatibility
- queued job claim smoke:
- ready_for_publish non-claim smoke:

## Windows Rebuild
- required: yes | no
- reason:

## Live Checks
- health:
- workers:

## No-Paid Confirmation
- Paid API / Apify / Naver save-publish was not called.
```

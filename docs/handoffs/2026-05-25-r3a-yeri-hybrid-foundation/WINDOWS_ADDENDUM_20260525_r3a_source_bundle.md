# Windows Addendum - R3-A Source Bundle Provided

작성일: 2026-05-25
상태: Windows 1차 결과 `blocked` 대응

## Windows 1차 결과 요약

Windows 반환 파일:

- `WINDOWS_RESULT_20260525_r3a_yeri_hybrid_foundation.md`

판정은 `blocked`였습니다.

이유:

- Windows 로컬 작업 폴더가 R3-A source snapshot이 아니었음
- 로컬 `server.js` hash가 live R3-A hash와 불일치
- R3-A smoke scripts가 Windows 로컬 폴더에 없어서 검증 불가

## 조치

R3-A 검증에 필요한 sanitized source bundle을 추가 제공했습니다.

파일:

- `aimax_r3a_yeri_hybrid_foundation_source_bundle_20260525.zip`

SHA256:

- `4328cd26cbc399c15e8573d93bbc2cff08e8e3e1ad1e33ba09a621e60a79d7d7`

포함 파일:

- `oracle/aimax-reports-api/server.js`
- `oracle/aimax-reports-api/static/app.html`
- `oracle/aimax-reports-api/static/admin.html`
- `scripts/smoke_yeri_hybrid_foundation.mjs`
- `scripts/smoke_yeri_hybrid_retry_api.mjs`
- `scripts/smoke_worker_catalog_contract.mjs`
- `scripts/smoke_job_platform_targeting.mjs`
- `scripts/smoke_json_storage_safety.mjs`
- `app.py`
- `split_version/app.py`
- `web_agent/client.py`

## Windows 재검증 지시

1. shared folder 안에서 실행하지 말고 Windows 로컬 임시 폴더로 zip을 복사/해제
2. 해당 폴더에서 아래 검증 실행
3. 결과를 `WINDOWS_RESULT_20260525_r3a_yeri_hybrid_foundation_RECHECK.md`로 반환

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

Live read-only:

```powershell
Invoke-RestMethod https://api.aimax.ai.kr/api/reports/health
Invoke-RestMethod https://api.aimax.ai.kr/api/workers
```

## No-Paid 원칙

- 유료 Gemini/OpenAI/Claude/Apify 호출 금지
- 네이버 저장/발행/실제 로그인 자동화 금지
- production job mutation 금지
- 고객 데이터/키/쿠키/브라우저 프로필/shared raw log 포함 금지

# Windows Handoff - R3-A Yeri Hybrid Foundation

작성일: 2026-05-25
요청자: Mac/server Codex
대상: Windows Codex 개발자

## 먼저 읽기

1. 이 문서
2. `WINDOWS_AI_COPYPASTE_PROMPT_20260525_r3a_yeri_hybrid_foundation.md`
3. 가능하면 프로젝트 문서 `docs/maintenance_reports/aimax_r3a_yeri_hybrid_foundation_20260525.md`

## 배경

Mac/server 쪽에서 R3-A 예리 Hybrid 기반 서버 변경을 완료하고 Oracle live web 배포까지 마쳤습니다.

이번 변경은 **Windows 설치본 재빌드가 아니라 서버 계약 변경에 대한 Windows 실행기 회귀 확인**입니다.

## Live 배포 정보

- deploy report: `docs/deployments/oracle-deploy-20260525-005826.md`
- remote `server.js` sha256: `79a0794163705eeaf2527d7b2eaed9cb3a5f921ba9fd9257ce65868cf79bf6dd`
- live health: `https://api.aimax.ai.kr/api/reports/health` -> `ok: true`
- live workers: `https://api.aimax.ai.kr/api/workers` -> `ok: true`

## 서버 변경 요약

- 새 상태 계약: `generating`, `ready_for_publish`
- 새 artifact 저장소: `data/artifacts/{job_id}.json`
- 새 retry API: `POST /api/jobs/:id/retry`
- 서버 시작 시 stale `generating` job 복구
- R3-A에서는 구버전 실행기 보호를 위해 `/api/agent/next-job`가 아직 `ready_for_publish`를 claim하지 않도록 유지

## Windows 확인 목표

1. Windows 실행기가 기존 `queued` job을 계속 정상 claim하는지 확인
2. `ready_for_publish` 상태는 R3-B 전까지 Windows 실행기가 가져가지 않는지 확인
3. `/api/workers` catalog가 Windows 쪽에서도 기존과 동일하게 해석되는지 확인
4. 신규 상태/필드가 Windows 코드 파싱을 깨지 않는지 확인
5. 설치본 재빌드가 필요 없음을 확인

## Cross-Platform User-Journey Gate

앞으로 사용자에게 보이는 AIMAX 기능 변경은 Mac 실사용 smoke와 Windows 실사용 smoke를 모두 통과하기 전까지 완료/배포 완료로 판정하지 않습니다.

이번 R3-A는 서버 기반/계약 준비 작업이고 `ready_for_publish`가 아직 agent claim 대상이 아니므로 선배포가 허용된 예외입니다. 그래도 Windows 쪽에서는 기존 `queued` job claim과 `ready_for_publish` non-claim을 반드시 확인해주세요.

## 금지

- 유료 Gemini/OpenAI/Claude/Apify 호출 금지
- 네이버 저장/발행/실제 로그인 자동화 금지
- 고객 데이터, API 키, 쿠키, `.env`, 브라우저 프로필, raw private log를 shared folder에 복사 금지
- Syncthing 공유 폴더 안에서 빌드 금지

## 권장 검증

Windows 로컬 작업 폴더에 복사 후 실행:

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

가능하면 live 확인:

```powershell
Invoke-RestMethod https://api.aimax.ai.kr/api/reports/health
Invoke-RestMethod https://api.aimax.ai.kr/api/workers
```

## 반환물

공유 폴더에 아래 파일을 남겨주세요.

- `WINDOWS_RESULT_20260525_r3a_yeri_hybrid_foundation.md`

포함 내용:

- verdict: `pass` / `blocked`
- 실행한 명령과 결과
- Windows 실행기 재빌드 필요 여부
- queued job claim 회귀 여부
- ready_for_publish non-claim 확인 여부
- 발견한 위험/추가 제안
- 유료 API/Apify/Naver 호출을 하지 않았다는 확인

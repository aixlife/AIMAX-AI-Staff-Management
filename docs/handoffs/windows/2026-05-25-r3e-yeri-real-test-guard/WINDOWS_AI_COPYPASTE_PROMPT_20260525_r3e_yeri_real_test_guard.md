너는 AIMAX Windows 환경의 Codex 개발자다. 이번 작업은 R3-E 예리 최소 유료 테스트 보호장치 검증이다.

중요:
- 유료 Gemini/OpenAI/Claude/Apify 호출 금지.
- Naver 로그인/저장/발행/수정 금지.
- 고객 계정/고객 credentials 사용 금지.
- Syncthing 공유 폴더 안에서 직접 빌드하지 말고, 로컬 Windows 작업 폴더로 복사해서 검증해라.
- secrets/passphrases/.env 원문은 공유 폴더에 쓰지 마라.

먼저 아래 문서를 읽어라.

```text
WINDOWS_HANDOFF_20260525_r3e_yeri_real_test_guard.md
docs/testing/aimax_r3e_yeri_minimal_real_test_criteria_20260525.md
```

작업:

1. 공유 폴더의 source bundle 또는 패치 파일을 로컬 Windows 작업 폴더에 반영한다.
2. 아래 명령을 Windows 환경에서 직접 실행한다.

```powershell
node --check oracle/aimax-reports-api/server.js
node --check scripts/smoke_yeri_real_test_guard.mjs
node scripts/smoke_yeri_real_test_guard.mjs
node scripts/smoke_yeri_paid_generation_guard.mjs
node scripts/smoke_yeri_ready_claim_gate.mjs
python scripts/smoke_yeri_local_artifact_contract.py
```

3. 결과를 공유 폴더에 `WINDOWS_RESULT_20260525_r3e_yeri_real_test_guard.md`로 반환한다.

반환 형식:

```md
# WINDOWS RESULT — R3-E Yeri Real-Test Guard

verdict: pass | blocked
tested_at: 2026-05-25T...+09:00
environment:
- os:
- node:
- python:

commands:
- ...

outputs:
```text
...
```

verification:
- YERI_REAL_TEST_GUARD_SMOKE_OK: yes/no
- YERI_PAID_GENERATION_GUARD_SMOKE_OK: yes/no
- YERI_READY_CLAIM_GATE_SMOKE_OK: yes/no
- YERI_LOCAL_ARTIFACT_CONTRACT_SMOKE_OK: yes/no
- no paid API calls: yes/no
- no Apify calls: yes/no
- no Naver mutation: yes/no
- no customer credentials: yes/no

blocker:
- none 또는 가장 좁은 원인
```

PASS가 아니면 임의로 우회하지 말고 가장 좁은 blocker만 보고해라.

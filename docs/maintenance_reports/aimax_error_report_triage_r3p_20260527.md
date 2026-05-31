# AIMAX Error Report Triage - R3-P 2026-05-27

## Summary

Checked production error reports after the Cafe24 automation work and the Windows R3-M/R3-O blocker.

Before triage:

- total reports: 51
- `new`: 14
- `reviewing`: 2
- `waiting_user`: 20
- `done`: 15

After triage:

- total reports: 51
- `working`: 15
- `waiting_user`: 21
- `done`: 15
- `new/reviewing`: 0

## Groups

- Windows update/download/version recognition: moved to `working`.
- Windows local settings / step 4 security settings: moved to `working`.
- Mac local settings / Naver password save loading loop: moved to `working`.
- Smart Editor input/image failure after generation: moved to `working`, with duplicate paid retry warning.
- Windows SmartScreen block: moved to `waiting_user` with `추가 정보 -> 실행` guidance.

## R3-O Stuck Job

The Windows visible-browser test job `9f282e93-7ca7-402b-8965-85c95ea14b52` was still `running` after delivery to the runner, with no runner start/done/failed update. It was cancelled safely with:

- `stage`: `runner_start_timeout`
- `error`: `runner_claim_after_delivery_timeout`
- duplicate paid retry: not performed

## Code Follow-Up

Added R3-P runner-start watchdog hardening:

- local runner sends a claim ACK when it receives a job,
- local runner fails a job if the internal worker does not start after claim,
- server distinguishes `runner_claimed_at` from `runner_started_at`,
- server sweeps delivered-but-not-started jobs to `failed/runner_start_timeout`,
- added `scripts/smoke_runner_start_timeout.mjs`.

Verification:

- `node --check oracle/aimax-reports-api/server.js`
- `python -m py_compile app.py local_agent/runtime.py`
- `node --check scripts/smoke_runner_start_timeout.mjs`
- `node scripts/smoke_runner_start_timeout.mjs`
- `node scripts/smoke_yeri_paid_generation_guard.mjs`
- `node scripts/smoke_yeri_hybrid_retry_api.mjs`

Production health after report/job triage:

- `GET https://api.aimax.ai.kr/api/reports/health` returned `ok=true`.

## Next

Windows R3-P handoff prepared:

- `handoffs/2026-05-27-r3p-runner-start-watchdog/WINDOWS_HANDOFF_20260527_r3p_runner_start_watchdog.md`
- `handoffs/2026-05-27-r3p-runner-start-watchdog/WINDOWS_AI_COPYPASTE_PROMPT_20260527_r3p_runner_start_watchdog.md`

Do not run another paid Windows visible-browser test until the no-paid R3-P checks pass and the owner approves the exact one-shot paid scope.


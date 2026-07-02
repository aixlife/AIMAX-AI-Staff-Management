# Windows Handoff - R3-P Runner Start Watchdog

Date: 2026-05-27 KST

## Purpose

R3-O proved the real visible-browser Windows flow can still get stuck after the server delivers a job to the installed runner. The single paid test job `9f282e93-7ca7-402b-8965-85c95ea14b52` remained `running` with only:

- `작업 요청이 생성되었습니다.`
- `작업이 실행기에 전달되었습니다.`

No runner-start, done, failed, Chrome, or current-job evidence appeared. The Mac side safely cancelled that demo job and did not submit a duplicate paid retry.

## Scope

Patch and verify Windows runner hardening only:

- runner claims job and immediately sends a `runner_event=claimed` ACK,
- runner fails the job with `runner_start_timeout` if internal worker does not start,
- server distinguishes `runner_claimed_at` from `runner_started_at`,
- server sweeps running jobs that were delivered but never started,
- no infinite `running` status after claim-delivery timeout.

## Source Files

Use these files from this handoff as the patch source:

- `source-files/app.py` -> repo root `app.py`
- `source-files/runtime.py` -> `local_agent/runtime.py`
- `source-files/server.js` -> `oracle/aimax-reports-api/server.js`
- `source-files/smoke_runner_start_timeout.mjs` -> `scripts/smoke_runner_start_timeout.mjs`

Copy the Syncthing folder to a local Windows work folder first. Do not build inside Syncthing.

## Required Windows Work

1. Read this handoff and the previous R3-M/R3-O result first.
2. Copy source out of Syncthing into a local Windows work folder.
3. Apply the four source files above, preserving their target paths.
4. Bump Windows runtime version to `v1.0.28` or state the exact patch version used.
5. Run no-paid verification:
   - Python compile for `app.py` and `local_agent/runtime.py`.
   - Node check for `oracle/aimax-reports-api/server.js`.
   - `node scripts/smoke_runner_start_timeout.mjs`.
   - Existing R3-I/R3-J/R3-K/R3-M no-paid smokes that cover installer, liveness, update recognition, open-settings/settings-save, legacy AppData self-heal, ai text import, and browser version detection.
6. Build `aimax-bundle-windows.exe`.
7. Install and verify the installed runner reports the patch version, frozen runtime true, and update recognition current=false/required=false when pointed at the matching test version config.
8. Run a no-paid production UI readiness check only: visible browser opens `https://api.aimax.ai.kr/app`, demo account session is usable, dashboard/settings show the installed runner connected and current. Do not create another paid Yeri job yet.

## Paid Test Rule

Do not submit another paid Yeri job automatically. The previous paid UI submit was already consumed and safely cancelled as stuck. A new one-shot paid visible-browser test requires separate owner approval with this exact scope:

- account: `demo@aimax.ai.kr`
- employee: Yeri
- model: Gemini 2.5 Flash / `gemini-2.5-flash`
- length: 800자
- image: 1
- mode: 임시 저장 only
- cost cap: 500 KRW
- one job only
- no duplicate retry before checking the existing job/result

## Forbidden

- Live deploy.
- Oracle version API change.
- Naver publish or schedule.
- Customer credentials or customer Naver account.
- Apify.
- Duplicate paid retry.
- Secrets, cookies, raw browser profiles, signed URLs, or passphrases in Syncthing.

## Return Files

Return these to this same Syncthing folder:

- `WINDOWS_RESULT_20260527_r3p_runner_start_watchdog.md`
- `aimax_r3p_v128_runner_start_watchdog_diag.json`
- `aimax-bundle-windows.exe`
- `NEXT_TRIGGER_20260527_r3p_runner_start_watchdog.json`

## Pass Criteria

- Windows version is `v1.0.28` or explicitly stated patch version.
- No-paid runner-start timeout smoke passes.
- A delivered-but-not-started job becomes `failed` with `runner_start_timeout` instead of staying `running`.
- A genuinely started job keeps running/done behavior and is not falsely timed out.
- Installed runner sends claim ACK and start update evidence.
- R3-I/R3-J/R3-K/R3-M behavior still passes.
- Existing user-facing issues remain covered: installer DeleteFile code 5, update recognition, local settings save completion, legacy AppData self-heal, open-settings/current runtime, ai_text_import_smoke, browser_version_detection.
- No paid AI, Apify, Naver publish/schedule/edit/save beyond approved no-paid checks.


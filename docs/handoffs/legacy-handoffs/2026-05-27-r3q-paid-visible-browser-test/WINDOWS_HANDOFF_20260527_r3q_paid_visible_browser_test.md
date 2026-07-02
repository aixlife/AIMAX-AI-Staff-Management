# Windows Handoff - R3-Q Paid Visible-Browser Test

Date: 2026-05-27 KST

## Purpose

Run the one approved Windows paid actual user-flow test after R3-P `v1.0.28` passed all no-paid checks.

This is the pre-deploy real user-path gate. Use the real production web UI in a visible Windows browser and the installed Windows runner. Do not replace this with API-only, headless-only, source-mode, or mock tests.

## Owner-Approved Paid Scope

The owner approved this exact paid scope:

- account: `demo@aimax.ai.kr`
- platform: installed Windows runner `v1.0.28`
- UI: `https://api.aimax.ai.kr/app`
- browser: visible Chrome or Edge
- employee: Yeri
- model: Gemini 2.5 Flash / `gemini-2.5-flash`
- text length: `800자`
- image count: `1`
- mode: `임시 저장` only
- expected UI estimate: about `62 KRW`
- hard cost cap: `500 KRW`
- number of submissions: exactly `1`

## Safety Rules

Allowed:

- one paid Yeri generation job within the approved scope
- one Naver draft-save mutation on the safe test account

Forbidden:

- duplicate paid retry before checking the existing job/result
- Naver publish
- Naver schedule
- customer credentials or customer Naver account
- Apify
- live deploy
- Oracle version API change
- raw secrets, cookies, browser profiles, or signed URLs in Syncthing

If the test fails after submit, do not submit another job. Record the job ID, visible status, runner claim/start/done/failed evidence, failed stage/reason, sanitized logs/result, and whether any artifact/result can be resumed without another paid text generation.

## Pre-Submit Checks

1. Confirm installed runner is `v1.0.28`.
2. Confirm dashboard/settings show the installed Windows runner connected/current.
3. Confirm updates/current version says current patch and `update_required=false`.
4. Confirm no old paid job is still running for the demo account.
5. Confirm the UI options are exactly:
   - Yeri
   - Gemini 2.5 Flash
   - 800자
   - image 1
   - 임시 저장
6. Capture the visible UI estimate before submit.

## Required Test Flow

1. Open `https://api.aimax.ai.kr/app` in visible Chrome or Edge.
2. Use `demo@aimax.ai.kr`.
3. Verify installed Windows runner `v1.0.28` is connected.
4. Create the Yeri job through the real UI only.
5. Submit exactly once.
6. Record the job ID immediately.
7. Watch runner evidence:
   - claim ACK
   - start update
   - no `runner_start_timeout`
8. Let the installed runner process the job.
9. Verify:
   - Naver automatic login passed
   - Smart Editor opened
   - title inserted
   - body inserted
   - image generated/uploaded/inserted
   - draft save completed
   - final server status is `done`
10. Capture sanitized final evidence.

## Pass Criteria

- Windows runner version `v1.0.28`
- job submitted exactly once from visible production UI
- UI estimate at or below 500 KRW
- job ID captured
- runner claim ACK captured
- runner start evidence captured
- no infinite running state
- final server job status `done`
- Naver login passed
- Smart Editor title/body/image insertion passed
- Naver draft save completed
- no publish/schedule/customer credentials/Apify/live deploy/Oracle version API change/duplicate retry

## Return Files

Return these to this same Syncthing folder:

- `WINDOWS_RESULT_20260527_r3q_paid_visible_browser_test.md`
- `aimax_r3q_v128_paid_visible_browser_test_diag.json`
- `NEXT_TRIGGER_20260527_r3q_paid_visible_browser_test.json`

Screenshots or evidence files may be included only if sanitized and free of secrets/session data.


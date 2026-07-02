# Copy/Paste Prompt - Windows R3-Q Paid Visible-Browser Test

You are the Windows AIMAX developer. Run R3-Q paid visible-browser test only.

Read first:

1. `WINDOWS_HANDOFF_20260527_r3q_paid_visible_browser_test.md`
2. R3-P result in `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-27-r3p-runner-start-watchdog/`

The owner has approved exactly one paid test with this scope:

- account: `demo@aimax.ai.kr`
- installed Windows runner: `v1.0.28`
- real production web UI: `https://api.aimax.ai.kr/app`
- visible Chrome or Edge
- employee: Yeri
- model: Gemini 2.5 Flash / `gemini-2.5-flash`
- text length: `800자`
- image count: `1`
- mode: `임시 저장` only
- hard cost cap: `500 KRW`
- exactly one job submit

Before submit:

1. Confirm installed runner is `v1.0.28`.
2. Confirm dashboard/settings show Windows runner connected/current.
3. Confirm update status is current patch with `update_required=false`.
4. Confirm no old paid demo job is still running.
5. Confirm UI estimate is at or below `500 KRW`.

Run:

1. Open `https://api.aimax.ai.kr/app` in a visible Windows browser.
2. Use `demo@aimax.ai.kr`.
3. Select Yeri / Gemini 2.5 Flash / 800자 / image 1 / 임시 저장.
4. Submit exactly once from the real UI.
5. Record the job ID.
6. Watch runner evidence: claim ACK, start update, final done/failed.
7. Verify Naver automatic login, Smart Editor open, title/body/image inserted, and draft save completed.
8. Capture final server job status and sanitized evidence.

Forbidden:

- duplicate paid retry
- Naver publish
- Naver schedule
- customer credentials/customer Naver account
- Apify
- live deploy
- Oracle version API change
- secrets/cookies/browser profiles/signed URLs in Syncthing

If anything fails after submit, do not submit again. Return the narrow blocker with job ID, stage, status, sanitized logs/result, and whether the artifact can be resumed without another paid generation.

Return files:

- `WINDOWS_RESULT_20260527_r3q_paid_visible_browser_test.md`
- `aimax_r3q_v128_paid_visible_browser_test_diag.json`
- `NEXT_TRIGGER_20260527_r3q_paid_visible_browser_test.json`

Screenshots/evidence files are okay only if sanitized and free of secrets/session data.


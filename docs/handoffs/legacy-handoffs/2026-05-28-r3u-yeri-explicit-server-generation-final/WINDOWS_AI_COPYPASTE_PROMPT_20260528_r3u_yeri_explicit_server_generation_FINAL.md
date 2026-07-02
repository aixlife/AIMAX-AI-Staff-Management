Read:

`C:\Users\likim\Documents\shared-bridge\20_Deploy-To-Windows\2026-05-28-r3u-yeri-explicit-server-generation-final\WINDOWS_FINAL_VERIFY_REQUEST_20260528_r3u_yeri_explicit_server_generation.md`

Task:

Run the final R3-U Yeri explicit server-generation verification on Windows using `demo@aimax.ai.kr`.

Important:

- Do not write, screenshot, store, echo, or include the password in any output.
- Get the password only out-of-band from the owner/operator if needed.
- Target installed runner is `v1.0.31`; do not downgrade to `v1.0.30`.
- Do not use customer credentials.
- Do not expose API keys, cookies, session tokens, signed URLs, or browser profiles.
- Do not publish, schedule, edit, or final-save anything to Naver.
- No duplicate paid retry. If a paid job id exists, check that job status/result first.

Paid scope:

- Only approve the confirmation dialog if the current Windows thread explicitly approves one paid Gemini test.
- Approved paid test scope is one Gemini `gemini-2.5-flash` Yeri server text generation, `word_count=300`, `image_count=0`, expected about 2 KRW, hard cap 10 KRW.
- If paid approval is not explicit, stop at the visible paid confirmation dialog and return evidence.

Required verification:

1. Refresh `https://api.aimax.ai.kr/app`.
2. Log in as `demo@aimax.ai.kr`.
3. Confirm dashboard/settings detects installed Windows runner `v1.0.31` current with `update_required=false`.
4. Capture sanitized `/api/workers`, `/api/user/secrets`, and `/api/agent/status?platform=windows`.
5. Confirm `yeri_write.server_generation.enabled=true`, `confirm_paid_required=true`, `real_test_only=true`, `max_word_count=500`, `max_image_count=1`.
6. Confirm web Gemini is configured without exposing key/fingerprint.
7. Confirm runner connected and Naver readiness `ready`.
8. Open Yeri and set model `gemini-2.5-flash`, word count `300`, image count `0`, draft/save-only test mode.
9. Submit and verify visible paid confirmation appears.
10. If explicit paid approval exists, confirm once.
11. Verify `/api/jobs` request includes `server_generation=true` and `confirm_paid=true`.
12. Verify job is created as `generating`, reaches `ready_for_publish`, and then the Windows runner claims/consumes the server artifact or returns a narrow runner-side blocker.
13. Return:
   - `WINDOWS_RESULT_20260528_r3u_yeri_explicit_server_generation_FINAL.md`
   - `aimax_r3u_yeri_explicit_server_generation_FINAL_diag.json`
   - sanitized visible evidence JSON/screenshots if useful

Pass requires visible confirmation, no local-readiness gate block, no duplicate paid retry, no Naver mutation, and no secrets in outputs.

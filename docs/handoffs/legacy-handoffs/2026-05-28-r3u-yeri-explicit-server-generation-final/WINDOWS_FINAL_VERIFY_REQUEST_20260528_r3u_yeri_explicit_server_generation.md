# Windows Final Verify Request - R3-U Yeri Explicit Server Generation

Date: 2026-05-28 KST

## Context

The previous Windows demo-account check was blocked because the test depended on making local Gemini readiness missing, then the local installation drifted from `v1.0.30` to `v1.0.31`.

Mac/server side fixed the root cause:

- Production Oracle now accepts Windows runner `v1.0.31` as current.
- Yeri server generation now runs only when the browser explicitly sends `server_generation=true`.
- Normal local Yeri jobs remain queued when `server_generation` is not requested.
- In real-test mode, the web UI can show the paid confirmation dialog even when local AI readiness is already `ready`.

Deploy evidence:

- `server.js` SHA256: `9e87e55e0de8094027d81683d61a5a4f6562f79f10f185e8f38f02fb62101a36`
- `static/app.html` SHA256: `0c85262318819f59d62a4c6c2d30cde5a2044d144cf1bed0a06baa1442958414`
- Oracle health passed.

## Account

Use `demo@aimax.ai.kr`.

Do not write, screenshot, store, or echo the password in any file, log, terminal output, screenshot, Syncthing document, or diagnostic JSON. Get it only out-of-band from the owner/operator if needed.

## Scope

Verify the production web UI and installed Windows runner together.

Target runner version is now `v1.0.31`. Do not downgrade to `v1.0.30`.

Allowed paid scope, only if explicitly approved in the current Windows thread:

- Provider/model: Gemini `gemini-2.5-flash`
- Action: one Yeri server text generation
- Input: one tiny Yeri job, `word_count=300`, `image_count=0`
- Expected visible estimate: about 2 KRW, hard cap 10 KRW
- Retry rule: no duplicate paid retry unless a job id exists and its status/result is checked first
- Naver mutation: no publish, no schedule, no edit, no final save unless separately approved

If paid approval is not explicit in the Windows thread, stop at the visible paid confirmation dialog and report that the final paid step needs approval.

## Required Steps

1. Refresh `https://api.aimax.ai.kr/app`.
2. Log in as `demo@aimax.ai.kr`.
3. Confirm dashboard/settings shows Windows runner `v1.0.31` current with `update_required=false`.
4. Capture sanitized `/api/workers`, `/api/user/secrets`, and `/api/agent/status?platform=windows`.
5. Confirm `/api/workers` advertises `yeri_write.server_generation.enabled=true`, `confirm_paid_required=true`, `real_test_only=true`, `max_word_count=500`, `max_image_count=1`.
6. Confirm `/api/user/secrets.providers.gemini.web_configured=true` without exposing any fingerprint or key value.
7. Confirm local runner is connected and Naver readiness is `ready`.
8. Open Yeri and set:
   - mode: draft/save test mode only
   - model: `gemini-2.5-flash`
   - word count: `300`
   - image count: `0`
9. Verify the Yeri estimate/notice mentions server generation and that a paid confirmation dialog appears after submit.
10. If paid approval is explicit, confirm once.
11. Verify `/api/jobs` is called with `server_generation=true` and `confirm_paid=true`.
12. Verify the job is created as `generating`, reaches `ready_for_publish`, and then the Windows runner claims it or shows a clear visible reason if claim cannot proceed.
13. Verify any consumed artifact has sanitized diagnostics and no raw API key, password, cookie, signed URL, or raw prompt secret.
14. Stop before any Naver publish/schedule/edit/final save unless separately approved.

## Return Files

Return these to this Shared-Bridge folder:

- `WINDOWS_RESULT_20260528_r3u_yeri_explicit_server_generation_FINAL.md`
- `aimax_r3u_yeri_explicit_server_generation_FINAL_diag.json`
- sanitized visible evidence JSON/screenshots if useful

## Pass Criteria

- Windows runner `v1.0.31` is current.
- The web UI no longer gets blocked by local Gemini readiness already being `ready`.
- Visible paid confirmation appears.
- With explicit paid approval, exactly one Gemini `gemini-2.5-flash` server generation job is created.
- Job reaches `ready_for_publish`.
- Windows runner either claims the job and consumes the server artifact, or returns a narrow runner-side blocker that is not the web/API fallback gate.
- No duplicate paid retry.
- No Naver publish/schedule/edit/final save.
- No secrets in outputs.

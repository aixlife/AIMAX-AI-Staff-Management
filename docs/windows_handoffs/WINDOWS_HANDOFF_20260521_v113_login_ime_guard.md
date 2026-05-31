# Windows Handoff 20260521 v1.0.13 Login IME Guard

## Purpose

Mirror the macOS `v1.0.7` login-input hotfix on Windows so users cannot accidentally type AIMAX web passwords while the keyboard is in Korean IME mode.
Also mirror macOS `v1.0.8` first-login heartbeat ordering so the web dashboard does not keep showing connection/loading while the local security settings dialog is open.

## Background

The macOS investigation found the main cause of repeated `invalid_credentials` was user input mismatch:

- The user had been typing the web password while the keyboard was in Korean mode.
- Earlier setup/login UX did not clearly warn about the input mode.
- Setup links previously accepted a single password field and could store values that users did not mean to type.

Production server hotfix is already deployed:

- `/setup` now has password confirmation.
- New passwords must be ASCII visible characters only: English letters, numbers, symbols.
- New passwords with Korean input, invisible characters, or spaces are rejected.
- `confirm_password` mismatch is rejected.

## Windows Task

Build a Windows Local Agent hotfix, recommended version `v1.0.13`, with the same local input protection:

1. Add/use `web_agent.client.password_input_error(password)`.
2. In the Windows web-agent login dialog:
   - Show a clear hint when the password field receives focus:
     - `비밀번호는 영문 입력 상태에서 입력해주세요. 한글로 입력된 값은 사용할 수 없습니다.`
   - Before login, reject:
     - Hangul characters
     - leading/trailing spaces
     - non-visible or non-ASCII characters
   - Clear the password field after rejection.
3. Keep existing `v1.0.12` login/keychain/safe-storage fixes.
4. Bump Windows Local Agent version to `v1.0.13` only if a new installer is produced.
5. After first successful web login, start web-agent polling/heartbeat before opening the local security settings dialog.

## No-Paid / No-Secret Rules

- Do not use real customer passwords, API keys, cookies, `.env`, browser profiles, setup links, signed URLs, or raw private logs.
- Do not run paid AI generation calls.
- Do not run Naver publish/save/draft tests.
- Use only local/unit/smoke checks.

## Verification

Required no-paid checks:

- `python -m py_compile web_agent/client.py app.py split_version/app.py local_agent/runtime.py aimax_compliance.py split_version/aimax_compliance.py`
- Unit/smoke check:
  - ASCII password like `Aimax!2345` passes.
  - Korean value like `비밀번호12345` is rejected before HTTP login.
  - Leading-space value like ` Aimax!2345` is rejected before HTTP login.
  - Full-width/non-ASCII value like `Ａimax!2345` is rejected before HTTP login.
- GUI smoke:
  - Password field focus shows Korean/English input warning.
  - Rejected value clears the password field.
  - Existing valid login path still succeeds with a sanitized test account if available.
  - First successful login produces an agent heartbeat/connected state even if the local settings dialog remains open.
- Version API after deploy:
  - Windows `current=v1.0.12` should require `v1.0.13`.
  - Windows `current=v1.0.13` should not require update.
  - macOS `current=v1.0.7` should remain update-not-required.

## Return Expectations

Write completion or blocker report back to the shared folder with:

- changed files
- installer path and SHA256
- verification output summary
- whether Windows `v1.0.13` was deployed
- confirmation that no paid AI calls and no Naver publish/save/draft tests were run

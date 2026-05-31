# Windows Handoff — R3-C Test Account Agent Check

Date: 2026-05-25

## Purpose

Run one final user-journey verification with a safe non-customer test account before Mac/server enables:

```text
AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED=1
```

This is not a code-change task. It is a controlled user-flow check.

## Context

Already passed:

- Windows installer `v1.0.18` built.
- Windows post-deploy install check passed.
- Installed diagnostics:
  - `system.app.version = v1.0.18`
  - `system.runtime.frozen = true`
  - `ai_text_import_smoke.ok = true`
- Public version API:
  - Windows `v1.0.17` -> update required.
  - Windows `v1.0.18` -> latest.

Still not enabled:

```text
AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED
AIMAX_YERI_SERVER_GENERATION_ENABLED
```

## Test Account Handling

Use only a safe non-customer test account explicitly provided by Minsoo.

Do not write the password into:

- shared folder
- Markdown reports
- terminal logs
- screenshots
- browser profile exports
- `.env`
- source files

If password input is needed, Minsoo should type it directly into the Windows environment or provide it through a private local secret flow. The returned report must identify the account only as:

```text
test_account: redacted test account
```

or partially masked email if Minsoo approves.

## Scope

Allowed:

1. Open AIMAX web app.
2. Log in with the safe test account.
3. Launch installed Windows runner `v1.0.18`.
4. Connect the runner to the web app.
5. Confirm update-required banner disappears for `v1.0.18`.
6. Confirm agent status reports Windows `v1.0.18`.
7. Confirm worker UI does not incorrectly require another update.
8. Confirm no `ready_for_publish` job is claimed while claim flag is off.

Not allowed:

- Do not run Naver login.
- Do not save/publish/schedule a Naver post.
- Do not create a real `yeri_write` job that would invoke paid generation.
- Do not run Gemini/OpenAI/Claude/Apify paid calls.
- Do not use customer credentials.
- Do not alter production server flags.

## Suggested Checks

### Public API

```powershell
curl.exe -fsS "https://api.aimax.ai.kr/api/version?platform=windows&current=v1.0.18"
curl.exe -fsS "https://api.aimax.ai.kr/api/reports/health"
```

Expected:

```text
update_required=false
health ok=true
```

### Installed Runner

```powershell
& "$env:LOCALAPPDATA\Programs\AIMAX\AIMAX.exe" --diagnostics-probe "$env:TEMP\aimax_r3c_v118_test_account_diag.json"
```

Expected:

```text
system.app.version=v1.0.18
system.runtime.frozen=true
ai_text_import_smoke.ok=true
```

### User Journey

Manual UI checks:

1. Open `https://api.aimax.ai.kr/app`.
2. Log in with the test account.
3. If update prompt appears before runner connection, it should ask for Windows `v1.0.18` only when the connected runner is old or absent.
4. Start the installed AIMAX runner.
5. Connect runner if needed.
6. Refresh dashboard/update tab.
7. Confirm connected runner reports `v1.0.18`.
8. Confirm no required update banner remains after connection.
9. Confirm no job was started.

## Return Files

Return to:

```text
20_Deploy-To-Windows\2026-05-25-r3c-windows-test-account-agent-check
```

Required:

```text
WINDOWS_RESULT_20260525_r3c_windows_test_account_agent_check.md
aimax_r3c_v118_test_account_diag.json
```

Optional:

```text
sanitized_screenshot_update_clear.png
```

Only include screenshots if they show no passwords, no tokens, no customer data, and no private browser/profile details.

## Report Required Fields

- verdict: `pass`, `blocked`, or `fail`
- installed app path
- diagnostics summary
- version API summary
- web login result with redacted account identity
- runner connection status
- connected runner version
- update-required banner result
- whether any job was created or claimed
- confirmation that paid API / Apify / Naver mutation / customer credentials were not used
- blockers, if any

## Pass Criteria

`pass` requires all:

1. Test account login succeeds.
2. Installed runner starts or is already running.
3. Web app sees Windows runner `v1.0.18`.
4. Required update state clears for `v1.0.18`.
5. No job execution, no paid API, no Naver mutation.
6. No customer data/secrets returned.


# AIMAX Error Report Triage - Web AI/API and Local Settings

Date: 2026-06-01 KST

## Scope

Checked production error reports after the 2026-05-29/2026-05-30 web deployments and the June 1 customer-waiting notice.

No paid generation, Apify run, Naver publishing, installer rollout, or customer credential test was performed.

## Production Snapshot Before

Report index:

```text
total: 72
done: 22
waiting_user: 41
working: 1
new: 8
reviewing: 0
```

The 8 `new` reports were:

- 7 local settings open/save reports across Windows `v1.0.30`, Windows `v1.0.33`, Windows `v1.0.35`, and macOS `v1.0.17`.
- 1 Windows `v1.0.35` AI/API setup confusion report.

## Root Cause

- The web app waited up to 60 seconds for the `open_settings` command to fully finish. If the user kept the settings window open, took longer to save, or closed it intentionally, the web app could submit an automatic error report even though the local runner received the request.
- Onboarding and setup copy still implied that Yeri users should enter API keys in the local security settings window, while the current product direction is web-managed AI/API keys and local-only Naver credentials.

## Changes Deployed

Deployment record:

```text
docs/deployments/oracle-deploy-20260601-004337.md
```

Follow-up copy cleanup deployment:

```text
docs/deployments/oracle-deploy-20260601-013249.md
```

Web app changes:

- Local settings command delivery is no longer treated as an automatic error report.
- Local settings save cancellation is shown as a neutral user action, not an operational failure report.
- Yeri setup/onboarding now says local settings store only Naver ID/password.
- AI/API setup is shown as a separate web settings step.
- Web secret notice audience now includes `yeri`, `hyunju`, and `blog_team` users, not only `bundle`/`songi`.
- Closing the June 1 service notice can reveal the AI/API settings notice next when applicable.
- Follow-up cleanup removed the remaining user-visible copy that implied Yeri model API keys must be entered in the local security settings window.

## Verification

Local checks:

```text
app.html script ok 1
node --check oracle/aimax-reports-api/server.js
python3 -m py_compile local_agent/runtime.py
LOCAL_SECRET_IMPORT_SMOKE_OK
USER_SECRETS_SMOKE_OK
```

Production checks:

```text
health ok: true
service active: aimax-reports-api.service
remote app.html sha256: 6169c6bb0b583bf65870bf13f6f98110e6d3b5907e25b0d507f934d71a4b6a9b
follow-up remote app.html sha256: 88ad294a64c8bb93102a2a7917357ff9fe994cdda6ece1cc006967c6a64250e4
```

Windows installed-runner follow-up:

```text
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-06-01-local-settings-save-followup/WINDOWS_AI_RESULT_20260601_local_settings_save_followup.md
```

Result:

- Production web UI opened from installed Windows runner context.
- Windows runner `v1.0.34` showed connected in the live settings screen.
- `설정 > 로컬 설정 열기` opened the native `AIMAX 로컬 보안 설정` window.
- Cancel path closed the window, left the web button ready, and created no new `AIMAX-RPT-*`.
- Save path closed the window, preserved runner connection/readiness, and created no new `AIMAX-RPT-*`.
- No Windows runner rebuild was needed for this issue.

## Report Updates Applied

Updated 8 reports from `new` to `waiting_user` with current user-facing guidance:

- `AIMAX-RPT-20260528061946-2c7c80b4`
- `AIMAX-RPT-20260528062102-3c90fbf5`
- `AIMAX-RPT-20260529074031-53cbc6d0`
- `AIMAX-RPT-20260529081248-555fe992`
- `AIMAX-RPT-20260530030437-8ea6c912`
- `AIMAX-RPT-20260530033549-a0bb4207`
- `AIMAX-RPT-20260530071318-318c3ffd`
- `AIMAX-RPT-20260530073901-00144f03`

Oracle backup suffix:

```text
.bak-20260531154550-20260601-web-ai-local-settings-triage
```

After Windows verification, moved the remaining working report to `waiting_user` with current update/retry guidance:

```text
AIMAX-RPT-20260528005841-aa3afc1d
```

Oracle backup suffix:

```text
.bak-20260601-windows-local-settings-verified
```

## Production Snapshot After

Report index:

```text
total: 72
done: 22
waiting_user: 50
working: 0
new: 0
reviewing: 0
```

There are no remaining `new`, `reviewing`, or `working` reports after the Windows verification follow-up.

## Next

1. Watch for fresh reports after the web hotfix. New local settings auto-reports should drop.
2. If the original `AIMAX-RPT-20260528005841-aa3afc1d` user still sees the problem on Windows `v1.0.30`, guide them to reinstall/reopen the current unified runner, refresh the web app, and retry the local settings window once.
3. Do not run paid Yeri tests unless a concrete paid scope is approved.

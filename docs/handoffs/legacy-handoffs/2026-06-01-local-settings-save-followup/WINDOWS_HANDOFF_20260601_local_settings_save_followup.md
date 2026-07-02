# Windows Handoff - Local Settings Save Follow-up

Date: 2026-06-01 KST

## Context

Mac/Oracle web hotfix was deployed in:

```text
docs/deployments/oracle-deploy-20260601-004337.md
```

The web hotfix stops false-positive local settings auto error reports and updates AI/API guidance so Yeri users are told to use web `설정 > AI/API 연결` for provider keys. Local security settings should store only Naver ID/password.

Production triage report:

```text
docs/maintenance_reports/aimax_error_report_triage_20260601_web_ai_local_settings.md
```

After triage, current production report counts are:

```text
done=22
waiting_user=49
working=1
new/reviewing=0
```

Remaining working report:

```text
AIMAX-RPT-20260528005841-aa3afc1d
```

This is a Windows local security settings save-cancel/still-failing case on Windows runner `v1.0.30`.

## Windows Task

Verify whether the installed Windows runner local security settings flow still has a real save/cancel issue after the web hotfix.

Use an installed Windows AIMAX runner, not source-only mode. Prefer the current production Windows installer/version available from the web app update tab. Do not run paid Yeri jobs, Apify runs, or Naver publish/schedule actions.

## Validation Steps

1. Read this handoff and the latest related handoff docs in the shared bridge folder.
2. Copy any needed source or notes out of Syncthing into a local Windows work folder. Do not build or edit inside the shared folder.
3. Open the production web app with a safe test account/session.
4. Confirm the web app no longer says API keys must be entered in local security settings.
5. Open `설정 > 로컬 설정 열기`.
6. Confirm the Windows local settings dialog visibly opens.
7. Verify the dialog only requires Naver ID/password for local security settings.
8. Test two no-paid paths:
   - Open dialog, then cancel. Expected: web should not create a fresh automatic error report for cancellation.
   - Open dialog, enter non-customer test values or existing safe test values, save. Expected: web gets a successful/neutral state, runner stays connected.
9. Capture evidence:
   - Windows version and runner version
   - visible web text for AI/API/local settings
   - local dialog screenshot or textual description
   - command/report status after cancel and after save
   - whether a new `AIMAX-RPT-*` was created

## Return Expectations

Write a completion or blocker report back to this same shared folder.

Include:

- Whether `AIMAX-RPT-20260528005841-aa3afc1d` is likely fixed by web guidance or still needs runner code.
- Whether a Windows runner rebuild is required.
- If code changes are needed, provide the exact files and smallest patch scope.
- If an installer is rebuilt, return installer filename, SHA256, version, and no-paid verification evidence.

## Guardrails

- Do not put secrets, API keys, Naver passwords, cookies, session tokens, or passphrases in Syncthing.
- Do not run paid API generation without explicit approved scope.
- Do not publish or schedule Naver content.
- Keep customer data redacted in screenshots and reports.

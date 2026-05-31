# Windows Handoff - AIMAX Error Report Direct Check

Date: 2026-06-01 KST

## Purpose

Give the Windows AI developer a safe way to inspect AIMAX production error reports directly when debugging Windows runner issues.

## Scope

- Read production error reports through the AIMAX admin UI.
- Optionally use the logged-in admin browser session to query admin report APIs from the browser console.
- Do not change report statuses unless Minsoo explicitly asks for that specific report and status.
- Do not use SSH or direct server files unless Minsoo separately grants that access.

## Current Context

Recent local-settings/API-key report cleanup is complete:

```text
total=72
done=22
waiting_user=50
new=0
reviewing=0
working=0
```

Related Mac/Oracle records:

```text
docs/maintenance_reports/aimax_error_report_triage_20260601_web_ai_local_settings.md
docs/deployments/oracle-deploy-20260601-004337.md
docs/deployments/oracle-deploy-20260601-013249.md
```

## Safe Access Method

Primary URL:

```text
https://api.aimax.ai.kr/admin#reports
```

Use an existing authorized admin browser session, or ask Minsoo to enter the admin credential directly on the Windows machine. Do not ask Minsoo to put admin secrets into Syncthing, chat logs, source files, screenshots, terminal history, or result reports.

The admin UI and `/api/admin/reports/:reportId` return each report's detailed stored JSON after server-side redaction. This is the right default for Windows debugging because it includes report context, app/OS version, visible error, support state, recent job/agent diagnostics when attached, and redacted payload fields without exposing raw secrets.

This is not raw SSH access to Oracle data files. Use SSH/direct file inspection only if Minsoo separately grants a narrow read-only method for a specific debugging task.

## Return Expectations

Return a Markdown report to this Syncthing folder with:

- access method used: admin UI, browser console API, or blocked
- whether secrets stayed out of files/logs
- visible report counts by status
- target report IDs inspected
- sanitized findings
- whether a Windows runner code/install change is needed
- any blocker or requested next action

Do not include passwords, API keys, cookies, session tokens, auth headers, Naver credentials, signed URLs, or raw unredacted customer data.

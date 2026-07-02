You are the Windows AI developer for AIMAX.

First read the latest handoff doc in the Syncthing shared folder:

```text
20_Deploy-To-Windows/2026-06-01-windows-error-report-direct-check/WINDOWS_HANDOFF_20260601_error_report_direct_check.md
```

Goal:

Set up a safe repeatable way for the Windows side to inspect AIMAX production error reports directly when debugging Windows runner issues.

Answer to the key question:

Yes, with an approved admin session you can inspect each individual report's detailed redacted JSON through the admin detail drawer or `/api/admin/reports/:reportId`. This is the same operational report detail Mac/Oracle uses for normal triage. It does not expose raw secrets or require direct Oracle SSH access.

Important rules:

- Do not store admin passwords, API keys, cookies, session tokens, auth headers, Naver credentials, signed URLs, or passphrases in Syncthing, source files, screenshots, terminal logs, browser snippets, or result reports.
- If admin login is needed, ask Minsoo to enter it directly on the Windows machine or use an already authorized admin browser session.
- Do not run paid AI/API generation, Apify, Naver publish, or Naver schedule actions.
- Do not change report status unless Minsoo explicitly asks for a specific report ID and target status.
- Do not use SSH/direct server files unless Minsoo separately grants that access.

Primary method: admin UI

1. Open:

```text
https://api.aimax.ai.kr/admin#reports
```

2. Log in only through an approved admin session. Do not record the password.
3. Open the `오류 보고` tab.
4. Use the table and detail drawer to inspect:
   - report_id
   - status/status_label/status_updated_at
   - account email only as already masked or visible in the admin UI
   - product
   - app_version
   - OS/platform
   - work_context
   - visible_error
   - public_message / next_update_message
   - redacted diagnostics
   - runner version/connection fields if present
5. Use the built-in copy buttons when useful:
   - `미완료 오류 보고 복사`
   - `전체 오류 보고 복사`
   - selected report copy/detail
6. Before putting copied content in Syncthing, remove anything that looks like a secret, token, cookie, auth header, signed URL, password, or raw private credential.

Optional method: browser console API after admin UI login

Use this only inside the already logged-in admin page at `https://api.aimax.ai.kr/admin#reports`. It uses the browser's existing admin session cookie; do not print or copy cookies.

```js
const data = await fetch("/api/admin/reports", { credentials: "include" }).then((r) => r.json());
const reports = data.reports || [];
const counts = reports.reduce((acc, report) => {
  acc[report.status || "unknown"] = (acc[report.status || "unknown"] || 0) + 1;
  return acc;
}, {});
console.log("counts", counts);
console.table(reports.map((report) => ({
  report_id: report.report_id,
  status: report.status,
  status_label: report.status_label,
  stored_at: report.stored_at,
  updated_at: report.status_updated_at,
  product: report.product,
  app_version: report.app_version,
  os: report.os,
  work_context: report.work_context,
  visible_error: report.visible_error,
})));
```

To inspect a specific report:

```js
const reportId = "PASTE_REPORT_ID_HERE";
const detail = await fetch(`/api/admin/reports/${encodeURIComponent(reportId)}`, {
  credentials: "include",
}).then((r) => r.json());
console.log({
  summary: detail.summary,
  report: detail.report,
});
```

Bulk detail check for current Windows-related reports:

Use this when you need to quickly inspect every non-done Windows report. It fetches each individual detail record and prints a sanitized working set. Keep the output local unless you have redacted it before writing to Syncthing.

```js
const data = await fetch("/api/admin/reports", { credentials: "include" }).then((r) => r.json());
const reports = data.reports || [];
const targets = reports.filter((report) => {
  const status = String(report.status || "");
  const haystack = [
    report.os,
    report.platform,
    report.app_version,
    report.product,
    report.work_context,
    report.visible_error,
    report.public_message,
    report.next_update_message,
  ].join(" ").toLowerCase();
  return status !== "done" && haystack.includes("windows");
});
const details = await Promise.all(targets.map(async (report) => {
  const detail = await fetch(`/api/admin/reports/${encodeURIComponent(report.report_id)}`, {
    credentials: "include",
  }).then((r) => r.json());
  const raw = detail.report || {};
  const agent = raw.system?.agent || raw.agent || {};
  const jobs = raw.system?.jobs_recent || raw.jobs_recent || [];
  return {
    report_id: report.report_id,
    status: report.status,
    status_label: report.status_label,
    status_updated_at: report.status_updated_at,
    stored_at: report.stored_at,
    account_email: report.account_email,
    product: report.product,
    app_version: report.app_version,
    os: report.os,
    work_context: report.work_context,
    visible_error: report.visible_error,
    public_message: report.public_message,
    next_update_message: report.next_update_message,
    user_response: report.user_response,
    runner: {
      connected: agent.connected,
      version: agent.version,
      platform: agent.platform,
      device_label: agent.device_label,
      status: agent.status,
      diagnostics: agent.diagnostics,
    },
    recent_jobs: jobs.map((job) => ({
      id: job.id || job.job_id,
      kind: job.kind,
      status: job.status,
      stage: job.stage || job.failed_stage,
      failed_keyword: job.failed_keyword,
      error: job.error || job.visible_error || job.last_error,
      updated_at: job.updated_at || job.finished_at || job.created_at,
    })).slice(0, 5),
    redacted_detail: raw,
  };
}));
console.log(`windows_non_done_reports=${details.length}`);
console.log(JSON.stringify(details, null, 2));
```

Bulk detail check for a known list of report IDs:

```js
const reportIds = [
  "PASTE_REPORT_ID_1",
  "PASTE_REPORT_ID_2",
].filter((id) => id && !id.startsWith("PASTE_"));
const details = await Promise.all(reportIds.map(async (reportId) => {
  const detail = await fetch(`/api/admin/reports/${encodeURIComponent(reportId)}`, {
    credentials: "include",
  }).then((r) => r.json());
  return {
    report_id: reportId,
    summary: detail.summary,
    redacted_detail: detail.report,
  };
}));
console.log(JSON.stringify(details, null, 2));
```

Safety check for copied detail:

- Keep report IDs and status fields.
- Keep redacted diagnostics that are already safe.
- Remove credentials, cookies, tokens, auth headers, raw local paths that expose private user names if not needed, signed media URLs, and any long opaque secret-looking strings.
- If unsure whether a value is sensitive, replace it with `[redacted]`.

Current expected production state after the 2026-06-01 Mac/Oracle cleanup:

```text
total=72
done=22
waiting_user=50
new=0
reviewing=0
working=0
```

Useful recent context:

```text
docs/maintenance_reports/aimax_error_report_triage_20260601_web_ai_local_settings.md
docs/deployments/oracle-deploy-20260601-004337.md
docs/deployments/oracle-deploy-20260601-013249.md
```

Return a Markdown result report to the same Syncthing folder named:

```text
WINDOWS_AI_RESULT_20260601_error_report_direct_check.md
```

Include:

- Windows version and browser used
- access method used: admin UI, browser console API, or blocked
- confirmation that no secrets were stored or copied
- visible report counts by status
- report IDs inspected, if any
- sanitized findings
- whether Windows runner code/install changes are needed
- blockers or next action needed from Minsoo/Mac/Oracle

If the admin UI/API is not enough because a bug requires direct Oracle file inspection, report that as a blocker and request a narrow read-only Oracle report-inspector path from Minsoo/Mac. Do not improvise broad SSH access.

Do not include raw admin credentials, cookies, session tokens, API keys, Naver passwords, signed URLs, or unredacted customer secrets.

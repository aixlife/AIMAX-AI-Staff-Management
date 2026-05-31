# AIMAX API

Small Node HTTP service for receiving AIMAX app error reports and handling MVP
account access.

Endpoints:

- `GET /health`
- `GET /api/reports/health`
- `POST /api/reports`
- `GET /api/reports` with `X-AIMAX-Report-Token`
- `GET /admin`
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/me`
- `GET /api/admin/catalog`
- `GET /api/admin/reports` with admin session or `X-AIMAX-Admin-Token`
- `GET /api/admin/reports/<report_id>` with admin session or `X-AIMAX-Admin-Token`
- `POST /api/admin/users/provision` with `X-AIMAX-Admin-Token`
- `POST /api/admin/users/send-guide` with admin session or `X-AIMAX-Admin-Token`
- `POST /api/admin/users/provision-batch` with admin session or `X-AIMAX-Admin-Token`
- `POST /api/admin/users/expire` with admin session or `X-AIMAX-Admin-Token`
- `POST /api/admin/users/delete` with admin session or `X-AIMAX-Admin-Token`
- `GET /api/admin/users?query=<email>` with `X-AIMAX-Admin-Token`
- `POST /api/auth/login`
- `GET /api/auth/me` with `Authorization: Bearer <session_token>`
- `POST /api/auth/change-password` with `Authorization: Bearer <session_token>`
- `POST /api/auth/logout` with `Authorization: Bearer <session_token>`
- `GET /app`
- `GET /api/version?current=<agent_version>`
- `GET /api/workers`
- `GET /api/downloads/options` with `Authorization: Bearer <session_token>`
- `GET /api/downloads/agent?platform=<macos|windows>&product=<bundle|yeri|hyunju>` with `Authorization: Bearer <session_token>`
- `POST /api/jobs` with `Authorization: Bearer <session_token>`
- `GET /api/jobs` with `Authorization: Bearer <session_token>`
- `GET /api/agent/status` with `Authorization: Bearer <session_token>`
- `POST /api/agent/heartbeat` with `Authorization: Bearer <session_token>`
- `POST /api/agent/commands` with `Authorization: Bearer <session_token>`
- `GET /api/agent/next-command` with `Authorization: Bearer <session_token>`
- `POST /api/agent/commands/update` with `Authorization: Bearer <session_token>`
- `GET /api/agent/next-job` with `Authorization: Bearer <session_token>`
- `POST /api/agent/jobs/update` with `Authorization: Bearer <session_token>`

Reports are stored under `/home/ubuntu/aimax-reports/data/reports/YYYY-MM-DD/`.
Users are stored in `/home/ubuntu/aimax-reports/data/users.json`.
Sessions are stored in `/home/ubuntu/aimax-reports/data/sessions.json`.
Jobs are stored in `/home/ubuntu/aimax-reports/data/jobs.json`.
Agent heartbeats are stored in `/home/ubuntu/aimax-reports/data/agents.json`.
Agent installer files are stored in `/home/ubuntu/aimax-downloads`.
`GET /api/agent/next-job` marks the returned job as `running` immediately so
parallel local agents cannot claim the same queued job. Tune
`AIMAX_AGENT_JOB_CLAIM_TTL_SECONDS` if the operational lease window needs to
change from the default 24 hours.

## Oracle deployment

- App path: `/home/ubuntu/aimax-reports-api`
- Data path: `/home/ubuntu/aimax-reports/data`
- Internal bind: `127.0.0.1:18988`
- User service: `aimax-reports-api`
- Public route target: `https://api.aimax.ai.kr/api/reports`
- Standard deploy script: `scripts/deploy_oracle.sh`

The report API requires `AIMAX_REPORT_TOKEN` when that environment variable is
set. Clients can pass it as `X-AIMAX-Report-Token` or `Authorization: Bearer ...`.

The browser admin page uses an HTTP-only admin session cookie after login.
Set `AIMAX_ADMIN_PASSWORD` for the browser login password. If it is not set,
`AIMAX_ADMIN_TOKEN` is used as a fallback admin secret. Direct admin API
requests can still use `X-AIMAX-Admin-Token` when `AIMAX_ADMIN_TOKEN` is set.
Do not expose this token to the user web frontend.

Admin onboarding email can be sent from the buyer registration result panel.
For Gmail sending from `naminsoo@aixlife.co.kr`, deploy a Google Apps Script Web
App that accepts JSON `{ secret, to, subject, text, html }`, validates
`AIMAX_MAIL_WEBHOOK_SECRET`, and sends with `GmailApp.sendEmail()` or
`MailApp.sendEmail()`. Configure the server with:

```text
AIMAX_MAIL_FROM=AIMAX <naminsoo@aixlife.co.kr>
AIMAX_MAIL_REPLY_TO=naminsoo@aixlife.co.kr
AIMAX_MAIL_WEBHOOK_URL=<apps-script-web-app-url>
AIMAX_MAIL_WEBHOOK_SECRET=<long-random-secret>
```

Alternatively, set `AIMAX_RESEND_API_KEY` and a verified `AIMAX_MAIL_FROM` to
send through Resend's HTTP API.

Auth sessions return a session token to the client. The server stores only a
SHA-256 hash of the session token.

Worker codes such as `yeri_writer` and `hyunju_sales` are local Agent roles.
They are not server-side AI workers; the user's Mac runs the actual automation.

## Verification status

- Internal health check: passed
- Unauthenticated POST: returns `401`
- Authenticated POST: stores report and returns `201`
- Server-side redaction: passed for email, authorization header, Naver cookies, API key, and long token strings
- Public AIMAX route: `api.aimax.ai.kr` Caddy route configured
- Caddy route for `/admin*`: configured on 2026-05-06
- DNS: authoritative HostingKR and Google DNS resolve `api.aimax.ai.kr` to `213.35.100.96`
- Server OS firewall: `80/443` opened and persisted with `netfilter-persistent` on 2026-05-04
- HTTPS health check: passed
- App module public POST: passed with report `AIMAX-RPT-20260504231652-cd5df7db`
- Buyer provisioning API: passed
- Browser admin page and admin session cookie flow: passed
- Browser admin batch buyer provisioning flow: passed
- First-login password change flow: passed
- Unauthorized admin access: returns `401`
- Web app `/app`: passed
- Jobs API: passed
- Agent heartbeat/next-job/update flow: passed
- Agent next-job includes redacted job payload for local execution: passed
- macOS web app job to local Agent dispatch E2E smoke: passed
- Session-authenticated web error report: passed
- Version check API: passed
- Local worker catalog API: passed
- OS-specific download options API: passed
- Session-authenticated installer download headers: passed

Uploaded downloads:

- `aimax-bundle-macos.dmg` — v1.0.2, web-login/agent-polling included
- `aimax-yeri-macos.dmg` — v1.0.2, web-login/agent-polling included
- `aimax-hyunju-macos.dmg` — v1.0.2, web-login/agent-polling included
- `aimax-bundle-windows.exe` — v1.0.2, web-login/agent-polling and `aimax://` connect included
- `aimax-yeri-windows.exe` — v1.0.2, web-login/agent-polling and `aimax://` connect included
- `aimax-hyunju-windows.exe` — v1.0.2, web-login/agent-polling and `aimax://` connect included

Production endpoint:

```text
https://api.aimax.ai.kr/api/reports
```

Auth endpoint base:

```text
https://api.aimax.ai.kr/api
```

Temporary web app URL:

```text
https://api.aimax.ai.kr/app
```

Important: macOS downloads use DMG files and Windows downloads use EXE installers.
Both include the local web Agent client. Users should install once, then use the
web app's `실행기 연결` button unless an update is required.

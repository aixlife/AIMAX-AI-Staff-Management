# Oracle Deploy 20260527 Cafe24 Review Alert

## Scope

- Add Telegram review alerts for ambiguous Cafe24 orders.
- Alert only when a Cafe24 order is stored as `needs_review`.
- Do not auto-create accounts, send onboarding emails, publish/schedule Naver work, or change version API.

## Changed Files

- `oracle/aimax-reports-api/server.js`
  - Adds `AIMAX_CAFE24_REVIEW_ALERTS_ENABLED`.
  - Adds optional `AIMAX_CAFE24_TELEGRAM_MESSAGE_THREAD_ID`, falling back to the existing Telegram thread.
  - Sends "[AIMAX 카페24 주문 확인 필요]" alert for `needs_review` orders.
  - Records `review_alert_sent_at`, `review_alert_error`, and `review_alert_error_at` on order rows.
  - Prevents repeat alerts after `review_alert_sent_at` exists.
- `oracle/aimax-reports-api/static/admin.html`
  - Shows Cafe24 review alert sent/error status in the order status cell.
- `scripts/smoke_cafe24_review_alert.mjs`
  - Verifies ambiguous order alert text and non-ambiguous order non-alert behavior.

## Local Verification

```text
node --check oracle/aimax-reports-api/server.js
node --check scripts/smoke_cafe24_review_alert.mjs
node scripts/smoke_cafe24_review_alert.mjs
admin.html scripts ok: 1
```

Local webhook smoke:

```json
{
  "unknown_product_order": {
    "status": "needs_review",
    "issue": "unknown_product",
    "review_alert_queued": true
  },
  "valid_yeri_order": {
    "status": "pending",
    "product": "yeri",
    "review_alert_queued": false
  }
}
```

## Oracle Deployment

- Host: `oracle-server`
- App dir: `/home/ubuntu/aimax-reports-api`
- Service: user `aimax-reports-api.service`
- Backup timestamp: `20260527-105644`
- Backups:
  - `/home/ubuntu/aimax-reports-api/server.js.bak-20260527-105644-cafe24-review-alert`
  - `/home/ubuntu/aimax-reports-api/static/admin.html.bak-20260527-105644-cafe24-review-alert`

Uploaded hashes:

```text
bddd29666f85ce58e1e12b799251c84cf1af9040a2060cfaa02b6da6de8efd84  /home/ubuntu/aimax-reports-api/server.js
8529dffc2e7dfb2ce791f1dac9bd7fc95d88005668edf084465badbfd6f6b13a  /home/ubuntu/aimax-reports-api/static/admin.html
```

Post-restart health:

```json
{
  "service": "active",
  "health": {
    "ok": true,
    "service": "aimax-reports-api",
    "storage": {
      "ok": true,
      "checked_files": 10,
      "issues": []
    }
  }
}
```

## Live Alert Smoke

One fake Cafe24 order was submitted to production using a disposable address and an unmapped product name. It was then immediately marked `ignored` after alert verification.

```json
{
  "created": true,
  "id": "454c1c73-c2ef-4abd-b341-0fb3615bcc86",
  "status": "needs_review",
  "issue": "unknown_product",
  "review_alert_queued": true,
  "review_alert_sent_at": "2026-05-27T01:58:21.672Z",
  "review_alert_error": "",
  "cleanup_status": "ignored"
}
```

Final order counts after cleanup:

```json
{
  "needs_review": 76,
  "pending": 2,
  "sent": 9,
  "ignored": 1
}
```

No recent `cafe24 review send failed`, `telegram_send_failed`, `request_error`, or `storage_unavailable` journal lines were found after the deploy smoke.

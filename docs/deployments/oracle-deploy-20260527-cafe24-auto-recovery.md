# Oracle Deploy 2026-05-27 Cafe24 Auto Recovery

## Scope

- Added failure-state tracking for Cafe24 automatic onboarding.
- Automatic processing now records stage, attempt count, failure stage, failure code, and Telegram alert status.
- Auto failures move unsent orders to `failed` so they are visible in the admin order queue.
- Added admin retry API for failed/provisioned/pending orders.
- Added admin resend mode for sent orders; it regenerates a one-time setup link and sends a fresh guide email.
- Added admin order-tab buttons: `자동 재시도` and `설정 링크 재발송`.
- Manual guide-send failures also mark the order failed and queue a Telegram failure alert.

## Safety

- Automatic retry is not background-looped; it is a deliberate admin action after a failure.
- Sent orders are not automatically resent. Resend requires an admin button action.
- Existing historical `pending` orders were not backfilled during this deploy.
- No customer email was sent during verification.

## Verification

- `node --check oracle/aimax-reports-api/server.js`
- `node --check scripts/smoke_cafe24_auto_send.mjs`
- `node scripts/smoke_cafe24_review_alert.mjs`
- Admin HTML inline script parse check passed.
- Oracle temp smoke: `smoke_cafe24_auto_send: PASS`
  - Normal valid order auto-created and auto-mailed through mock mail.
  - Review order stayed unsent until admin product correction.
  - Mock mail failure moved the order to `failed` with `mail_sending` stage.
  - Admin retry sent the failed order without creating a duplicate account.
  - Sent-order resend regenerated a single active setup link and sent a new guide.
- Oracle service restarted and reported `active`.
- Health check passed at `http://127.0.0.1:18988/health`.

## Backup

- `/home/ubuntu/aimax-reports-api/backups/20260527-203431/`

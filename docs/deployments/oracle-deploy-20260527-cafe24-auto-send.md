# Oracle Deploy 2026-05-27 Cafe24 Auto Send

## Scope

- Cafe24 normal orders now auto-process when the webhook receives a valid email and recognized product.
- Auto-processing provisions or updates the AIMAX account, creates a one-time setup link, and sends the onboarding guide email.
- Ambiguous orders still stay in `needs_review` and send the existing Telegram review alert instead of emailing a customer.
- When an admin corrects a review order to `pending` with a valid product/email, the same auto-process queue runs.
- Admin Cafe24 order rows show auto-processing start/error state.

## Safety

- No raw temporary password is emailed for Cafe24 onboarding; setup links are used.
- No customer mail was sent during deployment verification.
- Existing pending historical orders were not backfilled automatically to avoid surprise customer emails.

## Verification

- `node --check oracle/aimax-reports-api/server.js`
- `node --check scripts/smoke_cafe24_auto_send.mjs`
- `node scripts/smoke_cafe24_review_alert.mjs`
- Oracle temp smoke: `smoke_cafe24_auto_send: PASS`
  - Valid webhook order auto-created account and sent guide through mock mail webhook.
  - Ambiguous order did not auto-send.
  - Admin correction to pending triggered auto-create/send through mock mail webhook.
- Oracle service restarted and reported `active`.
- Health check passed at `http://127.0.0.1:18988/health`.

## Backups

- `/home/ubuntu/aimax-reports-api/backups/20260527-183605/`
- `/home/ubuntu/aimax-reports-api/backups/20260527-183943/`

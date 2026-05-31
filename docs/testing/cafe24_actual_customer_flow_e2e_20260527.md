# Cafe24 Actual Customer Flow E2E 2026-05-27

## Scope

- Production AIMAX server: `https://api.aimax.ai.kr`
- Test account: `e2e-cafe24-20260527114132@aimax.ai.kr`
- Product: `yeri`
- Order id: `8ebeace5-0d3b-4863-8a8f-4d242ae759c9`
- No customer email/account was used.
- No paid AI, Apify, Naver publish/schedule, or customer credentials were used.

## Result

- Cafe24 webhook accepted the internal test order.
- Order auto-processing completed with `status=sent` and `auto_process_stage=sent`.
- User account was created with `product=yeri`.
- Onboarding guide email event was recorded through `resend`; provider message id was present.
- One-time setup link opened in the real production setup UI.
- Password setup completed successfully in the browser.
- Login to `/app` completed successfully in the browser.
- Dashboard loaded with account status `실행 가능`.

## Evidence

- `docs/testing/evidence/cafe24-onboarding-20260527114132/01-setup-form.png`
- `docs/testing/evidence/cafe24-onboarding-20260527114132/02-setup-complete.png`
- `docs/testing/evidence/cafe24-onboarding-20260527114132/03-app-login.png`

## Cleanup

- Test order was changed to `ignored`.
- Test user was deleted.
- One login session was revoked.
- Production health check passed after cleanup.

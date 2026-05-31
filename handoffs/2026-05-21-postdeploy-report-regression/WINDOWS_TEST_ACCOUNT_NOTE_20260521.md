# Windows Test Account Note 20260521

## Purpose

Use this account only for the Windows `v1.0.14` live-login post-deploy regression check.

## Account

- Email: `aimax-regression-20260521@aimax.ai.kr`
- Product: `bundle`
- Status: active
- Execution allowed: yes, after the setup password is set

## Password Handling

The password is intentionally not written in this file, Codex chat, or Syncthing.

The setup link was opened on the MacBook so the operator can set the password directly. Use the operator-provided password through a private/manual channel only.

Do not store the password in Shared-Bridge, logs, screenshots, or reports.

## Test Boundary

Allowed:

- AIMAX web-login/live-login check
- Local Agent connection check
- Version/update check
- Local settings open check with fake placeholder API values only

Forbidden:

- real customer accounts
- real API keys
- customer logs
- `.env`
- cookies/browser profiles
- paid AI calls
- Apify Actor runs
- real Naver publish/save/draft


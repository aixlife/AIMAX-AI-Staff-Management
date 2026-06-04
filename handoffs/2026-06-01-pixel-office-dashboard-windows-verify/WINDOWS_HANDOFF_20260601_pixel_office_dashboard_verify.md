# Windows Handoff - AIMAX Pixel Office Dashboard Verification

Date: 2026-06-01

## Context

Mac-side Codex generated and deployed an AIMAX dashboard visual update using the built-in imagegen path:

- 16:9 retro RPG-style AIMAX office background
- 8 transparent pixel employee sprites: 예리, 현주, 나경, 현성, 상수, 윤미, 송이, 지은
- Dashboard now renders the office background with all 8 employees lightly moving on top
- Motion was reduced after review so the office background remains the main visual focus

No Windows installer rebuild, local runner change, Naver automation, paid AI test, or Apify run is part of this handoff.

## Deployed Files

Production deployment report:

- `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/docs/deployments/oracle-deploy-20260601-191513.md`
- Follow-up cleanup deploy: `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/docs/deployments/oracle-deploy-20260601-192152.md`

Main web file:

- `oracle/aimax-reports-api/static/app.html`

New image assets:

- `oracle/aimax-reports-api/static/assets/aimax-office-rpg-bg.png`
- `oracle/aimax-reports-api/static/assets/aimax-office-rpg-bg.webp`
- `oracle/aimax-reports-api/static/assets/aimax-pixel-employees-sheet.png`
- `oracle/aimax-reports-api/static/assets/pixel_employee_yeri.png`
- `oracle/aimax-reports-api/static/assets/pixel_employee_hyunju.png`
- `oracle/aimax-reports-api/static/assets/pixel_employee_nakyung.png`
- `oracle/aimax-reports-api/static/assets/pixel_employee_hyunseong.png`
- `oracle/aimax-reports-api/static/assets/pixel_employee_sangsu.png`
- `oracle/aimax-reports-api/static/assets/pixel_employee_yunmi.png`
- `oracle/aimax-reports-api/static/assets/pixel_employee_songi.png`
- `oracle/aimax-reports-api/static/assets/pixel_employee_jieun.png`

## Mac Verification Already Completed

- `git diff --check`: pass
- `bash -n scripts/deploy_oracle.sh`: pass
- `app.html` inline script parse: pass
- Local desktop browser: 16:9 floor visible, 8 workers loaded, background loaded, no console errors
- Local mobile browser: 16:9 floor visible, 8 workers loaded, labels hidden, no console errors
- Production `/api/reports/health`: 200, ok=true
- Production `/app`: 200, contains all pixel image references and `pixelRoute`
- Production selected assets: 200

Evidence:

- `docs/testing/evidence/aimax-pixel-office-dashboard-20260601/dashboard-desktop-balanced.png`
- `docs/testing/evidence/aimax-pixel-office-dashboard-20260601/dashboard-mobile-balanced.png`
- `docs/testing/evidence/aimax-pixel-office-dashboard-20260601/metrics-balanced.json`

## Windows Task

1. On Windows, open production AIMAX web app: `https://api.aimax.ai.kr/app`.
2. Login with the approved test account/session only. Do not use customer credentials.
3. Navigate to `대시보드`.
4. Verify the first dashboard visual shows:
   - Retro office background
   - All 8 pixel employees visible
   - Employees move subtly, not aggressively
   - Sidebar labels remain `직원 채용` and `직원 업무지시`
   - Brain preview appears below the office scene and remains large
   - Old dashboard cards `내 AI 직원` and `확인할 항목` do not appear on the dashboard
5. Check both normal desktop width and a narrow/mobile-like browser width if practical.
6. Capture screenshots and note any console/network errors.

## Return Expected

Write a Windows completion or blocker report back to this shared folder with:

- Windows browser and version
- account used, without password
- screenshots
- visible pass/fail notes for the 8 employees, background, motion balance, sidebar labels, and Brain preview
- any errors or stale-cache behavior

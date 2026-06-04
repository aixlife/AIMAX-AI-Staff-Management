# Windows Handoff - AIMAX Face Dashboard Restore Verification

Date: 2026-06-01

## Context

Mac-side Codex reverted the experimental pixel office dashboard visual after stakeholder feedback. The dashboard hero now shows real employee face photos floating again, while preserving:

- `직원 채용` / `직원 업무지시` sidebar labels
- stacked dashboard layout
- large AIMAX Brain preview below the face visual
- removal of old dashboard cards `내 AI 직원` and `확인할 항목`
- desktop face area changed from a tall 16:9-style field to a wide `6:1` banner, while mobile keeps the previous `16:9` layout

No Windows installer rebuild, local runner change, Naver automation, paid AI test, or Apify run is part of this handoff.

## Deployed Report

- restore deploy: `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/docs/deployments/oracle-deploy-20260601-195232.md`
- density follow-up deploy: `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/docs/deployments/oracle-deploy-20260601-195626.md`
- 6:1 banner follow-up deploy: `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/docs/deployments/oracle-deploy-20260601-200656.md`

## Expected Production Behavior

On `https://api.aimax.ai.kr/app` dashboard:

- The hero visual uses real face images, not pixel characters.
- Visible image sources include:
  - `avatar_yeri_circle.png`
  - `avatar_hyunju_circle.png`
  - `avatar_songi.jpg`
  - `avatar_yunmi.jpg`
- The faces gently move with `faceFloat`.
- On desktop, the face area should appear as a long horizontal banner (`6:1`) so the visual does not leave large empty vertical space.
- On mobile, the face area should retain the previous balanced `16:9` layout.
- No `pixel_employee_*`, `aimax-office-rpg-bg`, or `pixel-worker` dashboard references are visible in the rendered page.
- Old cards `내 AI 직원` and `확인할 항목` do not appear on the dashboard.
- AIMAX Brain preview remains below the face visual.

## Mac Verification Already Completed

- `git diff --check`: pass
- `bash -n scripts/deploy_oracle.sh`: pass
- `app.html` inline script parse: pass
- Local browser: `faceCount=4`, `allFacesLoaded=true`, `pixelCount=0`, `hasPixelAssetRefs=false`
- Local 6:1 banner check: desktop floor `971x162` (`ratio=6`, face width ratio `0.107`), mobile floor `373x210` (`ratio=1.78`, face width ratio `0.177`)
- Production `/api/reports/health`: 200, ok=true
- Production `/app`: 200, has face animation and face employees, desktop `aspect-ratio: 6 / 1`, mobile `aspect-ratio: 16 / 9`, no pixel refs, no old dashboard card refs

Evidence:

- `docs/testing/evidence/aimax-face-dashboard-restore-20260601/dashboard-desktop.png`
- `docs/testing/evidence/aimax-face-dashboard-restore-20260601/dashboard-mobile.png`
- `docs/testing/evidence/aimax-face-dashboard-restore-20260601/metrics.json`
- `docs/testing/evidence/aimax-face-dashboard-density-20260601/dashboard-desktop.png`
- `docs/testing/evidence/aimax-face-dashboard-density-20260601/dashboard-mobile.png`
- `docs/testing/evidence/aimax-face-dashboard-density-20260601/metrics.json`
- `docs/testing/evidence/aimax-face-dashboard-banner-20260601/dashboard-desktop.png`
- `docs/testing/evidence/aimax-face-dashboard-banner-20260601/dashboard-mobile.png`
- `docs/testing/evidence/aimax-face-dashboard-banner-20260601/metrics.json`

## Windows Task

1. Open `https://api.aimax.ai.kr/app` in a Windows browser.
2. Login with the approved test account/session only. Do not use or record customer credentials.
3. Navigate to `대시보드`.
4. Verify the dashboard hero shows floating real employee face photos, not pixel characters.
5. Verify `직원 채용` / `직원 업무지시` sidebar labels remain correct.
6. Verify old dashboard cards `내 AI 직원` and `확인할 항목` do not appear.
7. Verify desktop uses a wide `6:1` banner and does not leave the face visual feeling vertically empty.
8. Verify mobile still uses the more balanced `16:9` layout.
9. Verify AIMAX Brain preview remains below the face visual and renders at a large size.
10. Check both normal desktop width and a narrow/mobile-like width if practical.

## Return Expected

Write a completion/blocker report back to this shared folder with:

- Windows browser and version
- account email only, no password
- screenshots
- pass/fail notes for real face visual, gentle motion, desktop density, mobile layout, no pixel visual, no old cards, sidebar labels, Brain preview
- any console/network/cache errors

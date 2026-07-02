# Windows Handoff: AIMAX UI Label/Layout Verify

Date: 2026-06-01 KST

## Context

Mac-side Codex deployed a web-only AIMAX UI update to Oracle production.

Production web app:

- `https://api.aimax.ai.kr/app`

Deploy report:

- `docs/deployments/oracle-deploy-20260601-184328.md`

Remote deployed app hash:

- `81ce93a0a48d4f617afc0ca7e581078573471699844dc7f8fdfa9e849336654d`

This was a web-only deploy. No Windows runner code, installer, version API, paid AI, Apify, or Naver automation flow was changed.

## What Changed

- Sidebar visible label `직원` became `직원 채용`.
- Sidebar visible label `일시키기` became `직원 업무지시`.
- Internal selectors were preserved:
  - `data-tab="staff"`
  - `data-tab="jobs"`
  - `data-tab="settings"`
  - `data-tab="updates"`
  - `#reportForm`
  - `#myReportsTable`
- Desktop dashboard now stacks like mobile:
  - AIMAX office explanation card first.
  - AIMAX Brain video card below it, wider than before.
- Desktop staff page now stacks like mobile:
  - Staff cards first.
  - Staff detail/resume area below the cards, not sticky on the right.

## Windows Task

Run Windows installed-user verification only. No rebuild is requested unless you find a regression.

Use the installed Windows AIMAX unified runner and the approved safe test account/session already available in the Windows environment. Do not use customer credentials. Do not run paid AI generation, Apify paid collection, Naver publish, or Naver scheduling.

## Verify

1. Read the latest handoff docs in this Syncthing folder before starting.
2. Open production web app: `https://api.aimax.ai.kr/app`.
3. Confirm sidebar labels:
   - `대시보드`
   - `직원 채용`
   - `직원 업무지시`
   - `설정`
   - `업데이트 및 오류보고`
4. Confirm `직원 업무지시` opens through preserved selector `data-tab="jobs"` and job forms still appear according to entitlement/readiness.
5. Confirm desktop dashboard is vertically stacked, and the AIMAX Brain video is wider/larger than the previous right-side layout.
6. Confirm desktop staff page shows employee cards first and the selected employee detail below the cards, not as a right sticky panel.
7. Confirm `설정` still shows local settings and `로컬 설정 열기`.
8. Confirm `업데이트 및 오류보고` still shows update/download information, the error report form, and my report list.
9. Confirm no visible-text selector break in any Windows smoke scripts. If a script still expects literal `직원` or `일시키기`, list it.

## Return

Write a Markdown result file back to this same Syncthing folder with:

- Windows code change needed: yes/no
- Installed runner version and platform
- Account label/email only, no password/token
- Screenshots or visible text evidence
- Any selector/text regression
- Confirmation no secrets were placed in Syncthing
- Confirmation no paid AI, Apify paid collection, Naver publish, or schedule action was run


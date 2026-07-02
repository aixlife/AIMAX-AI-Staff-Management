# Windows Handoff: AIMAX UI Simplification Post-Deploy Verify

Date: 2026-06-01 KST

## Context

The AIMAX web UI simplification requested from Donggyu's feedback has been deployed to Oracle production.

Deploy report:

- `docs/deployments/oracle-deploy-20260601-051846.md`

Production web app:

- `https://api.aimax.ai.kr/app`

Remote deployed app hash:

- `ccce769a9a09353bc031b782ded35640dbdcfc28eeec213d76b01e7173f88c0f`

This was a web-only deploy. No Windows runner code, installer, version API, paid AI, Apify, or Naver automation flow was changed.

## What Changed

- Visible menu label `작업` became `일시키기`.
- Visible menu label now uses `업데이트 및 오류보고` instead of `지원`.
- Internal selectors were preserved:
  - `data-tab="jobs"`
  - `data-tab="settings"`
  - `data-tab="updates"`
  - `#openLocalSettingsBtn`
  - `#reportForm`
  - `#myReportsTable`
- Dashboard was simplified:
  - Removed repeated account/local-runner/setup detail panels from dashboard.
  - Added AIMAX office explanation, moving staff avatars, and sanitized AIMAX Brain graph preview.
  - Detailed setup/status remains in `설정`.
- Staff page now shows a resume/detail area:
  - role, execution type, usage condition, features, video-description placeholder.
- Updates and error reports are now under the visible `업데이트 및 오류보고` menu.

## Windows Task

Please run a Windows installed-user verification only. No rebuild is requested unless you find a regression.

Use the installed Windows AIMAX unified runner and the approved safe test account/session already available in the Windows environment. Do not use customer credentials. Do not run paid AI generation, Apify paid collection, Naver publish, or Naver scheduling.

## Verify

1. Open production web app: `https://api.aimax.ai.kr/app`.
2. Confirm the nav shows:
   - `대시보드`
   - `직원`
   - `일시키기`
   - `설정`
   - `업데이트 및 오류보고`
3. Confirm `일시키기` opens through the preserved selector `data-tab="jobs"` and shows hired/entitled employees.
4. Confirm 예리/현주/송이 forms are visible according to entitlement/readiness, but do not submit a paid or Naver-mutating job.
5. Confirm `설정` still shows local settings and the `로컬 설정 열기` button.
6. Confirm `업데이트 및 오류보고` shows:
   - update status
   - installer/download information
   - error report form
   - my error report list
7. Confirm required-update or update-available notices still route to the `업데이트 및 오류보고` screen.
8. Confirm no visible-text selector break in any Windows smoke scripts. If a script still expects literal `작업`, list it.

## Return

Write a Markdown result file back to this same Syncthing folder with:

- Windows code change needed: yes/no
- Installed runner version and platform
- Account label/email only, no password/token
- Screenshots or visible text evidence
- Any selector/text regression
- Confirmation no secrets were placed in Syncthing
- Confirmation no paid AI, Apify paid collection, Naver publish, or schedule action was run

# Windows Handoff: AIMAX UI Feedback Impact Check

Date: 2026-06-01

## Purpose

This handoff asks the Windows developer to review the planned AIMAX web UI simplification and confirm whether any Windows runner, installer, or automation changes are needed.

This is not a Windows build request yet. The first task is impact review and validation planning.

## Product Feedback Being Addressed

Donggyu's feedback:

- Dashboard should explain AIMAX more naturally, with staff avatars moving around and showing what AIMAX does.
- A preview-style "company brain" view, similar to an Obsidian graph view, may be better than exposing too many repeated status panels.
- Staff cards should expose each AI employee's resume: specs, functions, text, and video.
- The menu label `작업` should become `일시키기`.
- `일시키기` should show only the employees the user purchased/hired, and the user should click an employee to use them.
- The overall UI is too complex and repeats unnecessary content.
- Duplicate content between `대시보드` and `설정` should be removed. Detailed setup/status content should mostly remain in `설정`.
- Layout should become more linear and easier to scan.
- `업데이트 및 오류보고` must remain easy to find and check.

## Current Mac-Side Direction

Recommended UI direction:

- Keep the menu name `업데이트 및 오류보고`, not `지원`.
  - Reason: `지원` is too broad and may sound like customer service/FAQ. The actual function is update status and error report status, so the current direct label is clearer.
- Change the visible menu label `작업` to `일시키기`.
  - Important: this is a user-facing label change only. Internal `job`, `task`, API paths, job kinds, runner commands, and protocol names should not be renamed.
- Remove duplicated dashboard/setup explanations from the dashboard.
  - Keep detailed setup state in `설정`.
  - Dashboard should show only current next action, available employees, and lightweight AIMAX identity/brain visuals.
- Add staff resume/detail pages or modals later.
  - This is primarily web UI content.
- Add avatar movement / AIMAX Brain graph later as a web UI layer.
  - Use sanitized/abstract graph data only. Do not expose private Obsidian note names.
- Do not hide `업데이트 및 오류보고`.
  - Windows users especially need direct access to required update notices, runner version issues, and report follow-up.

## Windows-Side Questions

Please review and answer:

1. Does changing the visible menu label from `작업` to `일시키기` affect any Windows-side automation, tests, selector logic, screenshots, docs, or user guidance?
2. Does keeping `업데이트 및 오류보고` as-is create any issue for Windows update/version UX?
3. Do any Windows runner flows depend on visible text such as `작업 보기`, `작업 지시하기`, `업데이트 보기`, `설정 열기`, or `로컬 설정 열기`?
4. Are there Windows smoke tests that click by text instead of stable selectors? If yes, list them.
5. Does the Windows runner need any change if web dashboard setup details move mostly into `설정`?
6. Is there any risk that update-required banners, protocol connection prompts, or local settings prompts become harder to discover after this UI simplification?
7. Is any installer resource update needed for staff resumes, avatars, or AIMAX Brain visuals, or can all of that stay server/web-only?

## Windows Validation Requested After Web UI Patch Exists

When the Mac/server web UI patch is ready, please verify on Windows installed-user flow:

1. Install/run the current Windows unified AIMAX runner.
2. Log in to production or the provided test web target with the approved test account.
3. Confirm the dashboard does not show confusing duplicate setup/update content.
4. Confirm the `일시키기` menu shows hired/entitled employees and existing Yeri/Hyunju/Songi creation flows still work.
5. Confirm `설정` still exposes local settings, Naver readiness, AI/API connection guidance, and runner connection state.
6. Confirm `업데이트 및 오류보고` still shows update notices, report list, report detail/follow-up, and error report send flow.
7. Confirm required-update popup/banner is still discoverable and not repeatedly stuck.
8. Confirm error report payload still redacts secrets: passwords, API keys, tokens, cookies, auth headers, and signed URLs.

No paid AI generation test should be run unless the owner separately approves provider, model, action, cost cap, account, input size, mutation limit, and retry rule.

## Return Expectations

Please return a Markdown report to the same Syncthing folder with:

- Whether Windows code changes are needed: yes/no.
- If yes, exact file/module/test names and reason.
- Any visible-text selector risks.
- Any runner/update/local-settings regression risks.
- Screenshots or visible text evidence if a UI build is available.
- Confirmation that no secrets were placed in Syncthing.
- Confirmation that no paid AI job was submitted.

If a source ZIP or patch is provided later, copy it out of Syncthing into a local Windows work folder before building or testing. Do not build directly inside the shared folder.

# Windows AI Developer Collaboration Rules

Date: 2026-05-07
Project: AIMAX / NaverBlogAuto
Audience: Windows AI developer

## Purpose

This document defines how the Windows AI developer should coordinate with the Mac/Oracle-side developer.

The project now has two parallel work streams:

- Mac/Oracle side: web dashboard, Oracle API server, deployment, shared contracts
- Windows side: Windows Local Agent, Selenium/Chrome behavior on Windows, Windows installer/build, Windows verification

Some decisions and checks happen during conversation between the user and the Mac-side developer. When any of those items affect Windows work, they will be written into the shared Syncthing handoff folder as a Markdown document.

Before starting, resuming, or finalizing Windows work, read the latest shared handoff documents first.

## Shared Folder Rule

The shared Syncthing folder is the source of truth for cross-developer handoff notes.

Expected folder:

`20_Deploy-To-Windows/AIMAX-L1J-20260506`

Read all recently added files matching:

- `WINDOWS_AI_DEVELOPER_MESSAGE_*.md`
- `WINDOWS_AI_COLLABORATION_RULES_*.md`
- `WINDOWS_AI_*ADDENDUM*.md`

If multiple documents exist, read the newest dated document first, then any referenced prior document.

## Start-Of-Work Checklist

Before editing or building anything on Windows:

1. Read the latest collaboration/rules document.
2. Read the latest Windows developer message document.
3. Read any addendum document added after the main message.
4. Confirm the work boundary:
   - Windows Local Agent and Windows build: Windows developer
   - Oracle server/web dashboard/deployment: Mac-side developer
5. Confirm whether the task requires paid API calls or real blog publishing.
6. If paid API calls or real publishing are needed, stop and ask the user for explicit approval first.

## Ownership Boundary

### Windows Developer Owns

- Windows Local Agent behavior
- Windows Chrome/Selenium/undetected_chromedriver issues
- Windows Credential Manager or local secure storage behavior
- `aimax://agent/connect` behavior on Windows
- duplicate launcher / single-instance behavior on Windows
- Windows EXE installer build
- Windows smoke tests and install tests
- payload sent from Local Agent to Oracle API

### Mac/Oracle Developer Owns

- `oracle/aimax-reports-api/server.js`
- `oracle/aimax-reports-api/static/app.html`
- `oracle/aimax-reports-api/static/admin.html`
- Oracle deployment
- web dashboard display and UX
- server-side result sanitization
- shared payload contracts
- Mac DMG build unless explicitly reassigned

Do not edit or deploy Oracle/web files from the Windows side unless the user explicitly asks you to do so.

## Conversation-To-Document Rule

If the Mac-side conversation creates a Windows-relevant requirement, the Mac-side developer will write a new Markdown note in the shared handoff folder.

Examples:

- new payload contract
- new test case Windows must run
- user-reported Windows bug
- change in install/update direction
- packaging simplification decision
- paid API safety rule
- expected completion report format

Windows developer should treat newly added handoff documents as requirements, not as optional chat notes.

## Windows Completion Report Rule

When a Windows task is completed, write a short completion report back into the shared folder.

Suggested filename:

`WINDOWS_AI_STATUS_YYYYMMDD_<short-topic>.md`

Include:

- task summary
- changed file list
- Windows installer filename and version
- build commands used
- tests run
- test results
- known limitations
- whether any paid API call was used
- whether any real blog post was published
- sample payload sent to `/api/agent/jobs/update`
- screenshots/log snippets only if sanitized

Do not include:

- API keys
- passwords
- Naver cookies
- full signed media URLs
- raw secrets
- large unredacted Selenium traces

## Question/Blocker Rule

If Windows work is blocked by a Mac/Oracle-side decision, write a short question document instead of guessing.

Suggested filename:

`WINDOWS_AI_QUESTION_YYYYMMDD_<short-topic>.md`

Include:

- what you are trying to do
- exact blocker
- file/function involved
- what decision you need
- what you recommend, if any

## Current Critical Contracts

### Failed Blog Keyword Payload

When a blog keyword fails, send failed item details in `result.failed_posts[]`.

Minimum item fields:

- `keyword`
- `source`
- `status: "failed"`
- `stage`
- `error`

The server also accepts `result.failures[]`, but `failed_posts[]` is preferred.

### Invalid Session Recovery

For browser-closed / DevTools-disconnected / invalid-session recovery:

- recreate the browser driver at most once
- reuse already generated text/images
- do not automatically regenerate AI text/images
- do not duplicate paid generation

### Readiness Update

After the user saves local secure settings such as Naver account or API key, the Local Agent should immediately send a heartbeat/readiness update so the web dashboard reflects the change quickly.

### Duplicate Launcher Protection

Repeated clicks on `실행기 연결` / `aimax://agent/connect` should not start multiple conflicting Windows Local Agent instances.

Use a Windows-appropriate single-instance guard.

### Installer Direction

Future direction is single unified installer per OS:

- Windows: `aimax-bundle-windows.exe`
- macOS: `aimax-bundle-macos.dmg`

Yeri/Hyunju-specific installers are legacy compatibility, not the preferred future update path.

Do not remove legacy installers during the current hotfix unless explicitly assigned.

## Final Rule

When in doubt:

1. Do not guess across ownership boundaries.
2. Do not run paid or real publishing tests without explicit approval.
3. Write the question or status into the shared handoff folder.
4. Keep the payload contract and test evidence easy for the Mac/Oracle side to verify.


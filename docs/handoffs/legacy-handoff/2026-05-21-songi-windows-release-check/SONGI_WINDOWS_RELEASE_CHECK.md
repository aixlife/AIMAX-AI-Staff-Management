# Songi Windows Release And Codex Memory Handoff

Date: 2026-05-21
Project: AIMAX-AI-Staff-Management
Scope: Windows verification for Songi research/video analysis release, plus Windows Codex session-memory setup

## Background

Mac-side Oracle web deployment has been checked. The deployed web files match the local files by SHA256 and the Oracle service is active.

Relevant production behavior confirmed:

- `/app` returns 200 on the Oracle server.
- The deployed app includes Songi UI text: `송이에게 지시`.
- The deployed app includes product labels: `블로그팀`, `전체 통합`.
- The deployed app includes paid-operation safety errors:
  - `research_paid_operation_in_progress`
  - `research_gemini_high_demand`
- Current product split:
  - `blog_team` = Yeri + Hyunju only
  - `bundle` = Yeri + Hyunju + Songi

The remaining release risk is Windows-only: whether the Windows installer/runtime includes the media tools needed for Songi video analysis and whether the flow works silently in the backend without opening visible browser windows.

There is also one process requirement: Windows Codex work should save session records in the same style as the MacBook Codex setup, including decisions, insights, verification, and next actions.

## Do Not Use Shared Folder As Build Folder

Copy any provided source/artifact from Syncthing into a local Windows work folder first. Do not build or run the app directly inside the shared folder.

Do not place secrets, API keys, passphrases, `.env`, browser profiles, or decrypted credentials in Syncthing.

## Required Windows Codex Memory Setup

Set up Windows Codex so that it behaves like the MacBook workflow when the user ends a session.

Trigger phrases:

- `작업끝`
- `오늘 작업 끝`
- `세션 마무리`
- `정리하고 끝내자`
- `마무리 저장`
- `저장하고 종료`

Required behavior:

1. Save a full session summary as Markdown first.
2. Keep durable decisions and reusable insights clearly separated.
3. Update project memory only with stable decisions/insights, not one-off logs.
4. On the next broad project session, read project memory and the latest 1-2 relevant session logs before making assumptions.
5. Never save secrets, tokens, passwords, `.env` contents, browser profiles, signed URLs, or raw paid-provider credentials.

Preferred Windows paths:

- If an Obsidian vault exists:
  - `C:\Users\<USER>\Documents\creator-os-vault\sessions\AIMAX-AI-Staff-Management\`
  - `C:\Users\<USER>\Documents\creator-os-vault\projects\AIMAX-AI-Staff-Management.md`
  - `C:\Users\<USER>\Documents\creator-os-vault\daily\`
  - `C:\Users\<USER>\Documents\creator-os-vault\decisions\`
  - `C:\Users\<USER>\Documents\creator-os-vault\insights\`
- If no Obsidian vault exists:
  - `C:\Users\<USER>\Documents\Codex-Session-Logs\AIMAX-AI-Staff-Management\`
  - Create the same subfolders there: `sessions`, `projects`, `daily`, `decisions`, `insights`, `concepts`.

Required session summary sections:

- `Summary`: one-line summary.
- `Decisions`: durable decisions, each marked with `#decision`.
- `Insights`: reusable technical or operational lessons, each marked with `#insight`.
- `Changes`: changed files, features, or settings.
- `Verification`: builds, tests, browser checks, deployment checks.
- `Open Issues`: blockers, risks, or user-confirmation needs.
- `Next Actions`: concrete continuation tasks for the next AI session.
- `Connected Context`: why this session links to related project maps, decisions, insights, or previous sessions.

Sharing rule:

- The full local session record should stay in the Windows local vault/log folder.
- Only sanitized handoff summaries that are needed by Mac/Oracle work should be copied into Syncthing.
- Shared summaries must exclude secrets and private credentials.

## Questions To Answer

1. Does the Windows package/runtime include the required media tools?
   - `yt-dlp.exe`
   - `ffmpeg.exe`
   - `ffprobe.exe`

2. Can Songi process video links on Windows from the packaged runtime without opening visible browser windows?
   - YouTube link
   - Instagram/Reels link if a safe public sample is available

3. Are paid calls protected?
   - Gemini analysis must not run unless the app sends explicit paid confirmation.
   - Apify/SNS collection must not run unless the app sends explicit paid confirmation.
   - Duplicate paid requests for the same user/source/stage should be blocked or recoverable.

4. Does the user-facing dashboard match the intended product split?
   - `blog_team` users should not get Songi.
   - `bundle` users should get Songi.

5. Does error reporting work for Songi failures on Windows?
   - Report should include sanitized employee/workflow/stage/source/error/environment context.
   - Report must not include API keys, tokens, passwords, signed URLs, or raw media URLs when sensitive.

## Suggested Validation Steps

1. Install or run the latest Windows build in a clean local Windows folder.
2. Confirm the packaged folder contains or can resolve:
   - `vendor/media-tools/win32/x64/yt-dlp.exe`
   - `vendor/media-tools/win32/x64/ffmpeg.exe`
   - `vendor/media-tools/win32/x64/ffprobe.exe`
3. Connect the local Windows runtime to the web app.
4. Log in with a test account that has `bundle` access.
5. Open the normal 작업 flow and choose Songi.
6. Run a no-paid/basic URL read test first.
7. Confirm the UI does not auto-trigger Gemini or Apify without paid confirmation.
8. If a paid test is needed, stop and ask Minsoo for explicit approval before running it.
9. Confirm any failure can be submitted through the existing 오류 보고 flow.

## Return Report Format

Return a Markdown report to this same Syncthing folder with:

- Windows build/version tested
- Exact artifact or installer filename
- Whether media tools are bundled and their paths
- Test account product used: `blog_team` or `bundle`
- Songi UI visibility result
- YouTube basic URL read result
- Instagram/Reels result, or reason not tested
- Paid-call guard result
- Error-report result
- Windows Codex memory setup result
- Session-log path used on Windows
- Screenshots or logs if useful, excluding secrets
- Final verdict:
  - `OK to release`
  - `Blocked`
  - `Needs Mac/web follow-up`

## Current Mac-Side Verdict

Oracle/web deployment is OK. Do not block on web hash mismatch. If the dashboard looks different, first check account product, cached login state, and local test-data differences.

Windows release should be held until this Windows media-tools/runtime check is complete.

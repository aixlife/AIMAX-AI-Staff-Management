# Songi Windows Rebuild Handoff

Date: 2026-05-21
Project: AIMAX-AI-Staff-Management
Task: Rebuild the Windows AIMAX artifact with the latest Songi web/runtime source and media tools.

## Why This Is Needed

Mac/Oracle web deployment is already current and active, but the Windows release artifact checked by the Windows developer is blocked.

Windows report:

- Report file: `WINDOWS_AI_STATUS_20260521_songi_release_check.md`
- Final verdict: `Blocked`

Main blockers:

1. `aimax-bundle-windows.exe` v1.0.13 does not include the Songi web/runtime module.
2. The v1.0.13 artifact does not include media tools:
   - `yt-dlp.exe`
   - `ffmpeg.exe`
   - `ffprobe.exe`
3. The older local Songi package that passed no-paid checks does not include the latest Mac/web strings and product split:
   - `blog_team`
   - `블로그팀`
   - `전체 통합`
   - `research_paid_operation_in_progress`
   - `research_gemini_high_demand`

## Provided Files

Shared folder:

`/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-21-songi-windows-release-check/`

Files to use:

- `WINDOWS_AI_STATUS_20260521_songi_release_check.md`
- `aimax-songi-latest-web-source-20260521.zip`
- `aimax-songi-latest-web-source-20260521.zip.sha256`
- `aimax-songi-windows-media-tools-bundle-20260519.zip`
- `aimax-songi-windows-media-tools-bundle-20260519.zip.sha256`

## Build Rule

Do not build inside Syncthing. Copy the provided files into a local Windows work folder first.

Do not place `.env`, API keys, tokens, cookies, browser profiles, signed URLs, or decrypted credentials in Syncthing.

## Required Implementation

1. Copy the latest Songi web/runtime source into the Windows release source.
2. Ensure the final Windows package includes:
   - `oracle/aimax-reports-api/server.js`
   - `oracle/aimax-reports-api/static/app.html`
   - `oracle/aimax-reports-api/static/admin.html`
   - `oracle/aimax-reports-api/static/setup.html`
   - `oracle/aimax-reports-api/vendor/media-tools/README.md`
3. Ensure media tools are bundled at:
   - `oracle/aimax-reports-api/vendor/media-tools/win32/x64/yt-dlp.exe`
   - `oracle/aimax-reports-api/vendor/media-tools/win32/x64/ffmpeg.exe`
   - `oracle/aimax-reports-api/vendor/media-tools/win32/x64/ffprobe.exe`
4. Rebuild the Windows artifact.

## Required Verification

Verify the rebuilt artifact, not just the unpacked source folder.

Check that the rebuilt artifact/source tree contains:

- `송이에게 지시`
- `블로그팀`
- `전체 통합`
- `research_paid_operation_in_progress`
- `research_gemini_high_demand`
- `yt-dlp.exe`
- `ffmpeg.exe`
- `ffprobe.exe`

Run no-paid checks only:

- YouTube basic URL read.
- Instagram/Reels pre-collection or `apify_key_missing` state.
- Gemini must return `402 research_paid_confirmation_required` without paid confirmation.
- Apify item/profile collection must return `402 research_paid_confirmation_required` without paid confirmation.

Confirm product split:

- `blog_team` = Yeri + Hyunju only.
- `bundle` = Yeri + Hyunju + Songi.

Confirm Songi error reporting:

- Public YouTube/Instagram URL is acceptable.
- Signed/private media URL must be redacted enough that host/path/token cannot leak sensitive media access.

## Return Report

Return a new Markdown report in the same shared folder.

Required report fields:

- Rebuilt artifact filename.
- Version.
- SHA256.
- Whether Songi web/runtime source is included.
- Whether media tools are included and their paths.
- Latest Mac/web string check result.
- Product split check result.
- YouTube no-paid read result.
- Instagram/Reels no-paid/pre-collection result.
- Paid-call guard result.
- Error-report redaction result.
- Final verdict:
  - `OK to release`
  - `Blocked`
  - `Needs Mac/web follow-up`

Do not mark `OK to release` unless the rebuilt artifact itself passes the checks.

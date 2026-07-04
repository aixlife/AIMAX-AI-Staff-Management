# 지은 macOS 다운로드 운영 반영 승인 체크리스트 - 2026-07-01

## Goal

지은 `AI 오피스 지원`을 Windows 전용 다운로드에서 Windows + Apple Silicon Mac 다운로드 지원으로 확장한다.

## Current Production State

- `https://api.aimax.ai.kr/downloads/AIMAX-Office-Manager-macOS-0.2.0-aarch64.dmg` returns `HTTP 404`.
- `/api/workers` production catalog still reports Jieun:
  - `supported_platforms=["windows"]`
  - `setup_download_url=https://api.aimax.ai.kr/downloads/AIMAX-Office-Manager-Setup-0.1.6.exe`
  - no macOS execution option
- Oracle service is currently active.

## Prepared Local Artifact

- Local file: `dist/upload_installers/AIMAX-Office-Manager-macOS-0.2.0-aarch64.dmg`
- Size: 36 MB
- SHA256: `14c4c6d4099fee057100ba0ea0ae469730854c6a6a7c80e807fbf4dd938a8619`
- Built from source branch: `https://github.com/aixlife/aimax-viseo/tree/feature/jieun-tauri-macos-v017`
- Source commit: `d6ae2eb Disable native window shadow and align macOS memo copy`
- Supersedes the 2026-07-01 DMG (`4f509535…`), which is discarded due to a
  Retina coordinate bug that could place the character window off-screen.
- 2026-07-04 rebuild also includes: macOS-unsupported action buttons fully
  hidden, monochrome line icon set, native window shadow disabled (removed
  the sticker-like outline next to the character), Spaces visibility fix.

## Prepared AIMAX Web Branch

- Branch: `https://github.com/aixlife/AIMAX-AI-Staff-Management/tree/codex/jieun-macos-download`
- Commit: `475e3b6 Prepare Jieun macOS download rollout`
- Draft PR: `https://github.com/aixlife/AIMAX-AI-Staff-Management/pull/1`

## Prepared Jieun App Source Branch

- Branch: `https://github.com/aixlife/aimax-viseo/tree/feature/jieun-tauri-macos-v017`
- Commit: `441c481 Add Tauri macOS distribution build`
- Draft PR: `https://github.com/aixlife/aimax-viseo/pull/5`
- Base branch: `feature/windows-shutdown-button`
- Note: the Windows v0.1.6 chain PRs are still open upstream, so this Tauri PR intentionally targets the Windows shutdown branch rather than `main`.

## Changes To Deploy

- Upload DMG to `/home/ubuntu/aimax-downloads/AIMAX-Office-Manager-macOS-0.2.0-aarch64.dmg`
- Update `server.js` public download whitelist.
- Update Jieun worker catalog:
  - `supportedPlatforms=["windows", "macos"]`
  - add Windows download option
  - add Apple Silicon Mac DMG download option
- Update static app fallback catalog and platform-aware download option selection.
- Update deploy script so future `external-staff` deploys include the Mac DMG.

## Pre-Deploy Checks Already Passed

- `node --check oracle/aimax-reports-api/server.js`
- `oracle/aimax-reports-api/static/app.html` inline script parse
- `bash -n scripts/deploy_oracle.sh`
- `scripts/deploy_oracle.sh external-staff --dry-run`
- `scripts/deploy_oracle.sh web --dry-run`
- DMG mount/copy/launch local smoke
- GitHub Actions workflow runs: none configured/found for the two PR head commits.
- `node --check scripts/smoke_jieun_macos_download.mjs`
- Pre-deploy production smoke intentionally fails because production still has no macOS Jieun option:
  - `node scripts/smoke_jieun_macos_download.mjs`
  - observed error: `Jieun supported_platforms does not include macos`
- 2026-07-04 desktop cleanup (`바탕화면 청소`/`바탕화면 복구`) real-device e2e:
  hide pass flagged every Desktop item via `chflags hidden` and wrote the
  manifest (`~/Library/Application Support/AIMAX Office Manager/desktop_hidden_tauri.json`),
  restore pass cleared all hidden flags and emptied the manifest. Verified on
  the installed production build (cdhash identical to the DMG payload).

## Deployment Commands

Run after explicit approval:

```bash
scripts/deploy_oracle.sh external-staff
scripts/deploy_oracle.sh web
```

## Post-Deploy Verification

```bash
curl -I -L https://api.aimax.ai.kr/downloads/AIMAX-Office-Manager-macOS-0.2.0-aarch64.dmg
curl -sS -L https://api.aimax.ai.kr/api/workers | rg 'AIMAX-Office-Manager-macOS|supported_platforms|execution_options|jieun'
node scripts/smoke_jieun_macos_download.mjs
```

Expected:

- DMG URL returns `HTTP 200`.
- Remote SHA256 matches `14c4c6d4099fee057100ba0ea0ae469730854c6a6a7c80e807fbf4dd938a8619`.
- `/api/workers` shows Jieun with `windows` and `macos`.
- AIMAX web app shows a Mac download option on macOS.
- `scripts/smoke_jieun_macos_download.mjs` exits 0 and prints `ok: true`.

## Important Release Risk

This DMG is ad-hoc signed because this Mac currently has `0 valid identities` for code signing. It can be downloaded, mounted, copied, and launched locally, but users who download it from the browser may see macOS Gatekeeper warnings until a Developer ID Application certificate and Apple notarization are applied.

Ad-hoc signing also affects the screen capture permission: macOS ties the
Screen Recording grant to the binary's code hash, so every new app version
users install resets the permission and macOS shows the "시스템 설정 열기"
prompt again on first capture. Users grant once per installed version. If a
stale grant from an older binary lingers, `tccutil reset ScreenCapture
com.aimaxviseo.office` clears it. A stable signing identity (Developer ID)
would make the grant survive updates.

The same caveat applies to the Desktop-folder permission used by `바탕화면
청소`: on a fresh machine the first cleanup click may show a one-time
"데스크탑 폴더의 파일에 접근" consent prompt, and an ad-hoc re-signed update
can require granting it again.

For a public customer release with fewer macOS trust warnings, first rebuild with:

```bash
APPLE_SIGNING_IDENTITY="Developer ID Application: <Team Name> (<TEAMID>)" \
APPLE_ID="<apple-id>" \
APPLE_PASSWORD="<app-specific-password>" \
APPLE_TEAM_ID="<TEAMID>" \
NOTARIZE=1 \
npm run tauri:build:mac-dmg
```

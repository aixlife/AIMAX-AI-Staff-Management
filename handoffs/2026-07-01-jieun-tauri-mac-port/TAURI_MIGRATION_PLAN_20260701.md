# Jieun Tauri macOS Port Plan

Date: 2026-07-01
Project: AIMAX / Jieun `AI 오피스 지원`
Source repo: `aixlife/aimax-viseo`
Decision: build the macOS version as a Tauri app, not as an Electron macOS build.

## Current State

- Production Jieun is an external-download desktop employee.
- Current production version is Windows-only `v0.1.6`.
- AIMAX catalog currently exposes:
  - `supportedPlatforms: ["windows"]`
  - setup: `AIMAX-Office-Manager-Setup-0.1.6.exe`
  - portable: `AIMAX-Office-Manager-portable.exe`
- Source repo currently uses Electron + React + TypeScript.
- Existing Electron scripts include `build:mac`, but the packaging config is Windows-first and the product behavior includes Windows-only operations.

## Why Tauri For The Mac Version

Tauri is the preferred direction for this port because the Jieun app is a small always-on desktop helper. Tauri should reduce runtime footprint and lets us move OS-sensitive work into explicit Rust commands with tighter permissions.

This is not a one-line build target change. It is a shell/backend migration:

- React UI can mostly be preserved.
- Electron main/preload IPC must be replaced with Tauri `invoke` commands and events.
- Native capture, file operations, desktop hide/show, recording conversion, and shutdown/sleep operations move to Rust or Tauri plugins.
- macOS permission behavior must be tested on a real installed `.app` or `.dmg`, not only in dev mode.

Official docs checked:

- Tauri distribution/build/bundling: https://v2.tauri.app/distribute/
- Calling Rust from frontend: https://v2.tauri.app/develop/calling-rust/
- Capabilities/permissions: https://v2.tauri.app/security/capabilities/
- Window customization: https://v2.tauri.app/learn/window-customization/
- External binaries/sidecars: https://v2.tauri.app/develop/sidecar/

## Phases

### Phase 0 - Migration Design

Purpose: decide the migration surface before changing the source repo.
Scope: source inventory, feature mapping, macOS MVP definition, risk gate.
Deliverable: this plan plus an implementation checklist for the `aimax-viseo` repo.
Verification: each Electron IPC feature has a Tauri target, a test path, and an explicit defer/keep/drop decision.

### Phase 1 - Tauri Scaffold Branch

Purpose: create a safe Tauri branch without breaking the Windows Electron release line.
Scope:

- Branch from the latest merged Jieun source, preferably after the Windows shutdown PR is merged into `main`.
- Add `src-tauri/` and Tauri build scripts.
- Keep existing React renderer assets/components where practical.
- Introduce a compatibility wrapper replacing `window.viseobarAPI` with Tauri commands.

Deliverable:

- Branch: `feature/jieun-tauri-macos-v017`
- Runs in `npm run tauri dev` on Apple Silicon Mac.

Verification:

- `npm install` or selected package manager install passes.
- `npm run build` for the renderer passes.
- `cargo check` passes.
- Tauri dev app opens a transparent/floating character window.

### Phase 2 - macOS MVP Features

Purpose: ship the smallest real Mac build that feels like Jieun.
Scope:

- Floating character window.
- Expand/collapse menu.
- Capture overlay.
- Capture to editor.
- Mosaic/redaction edit and save.
- Local OCR where feasible.
- Memo save/load.
- Open AIMAX blog app in browser.
- Desktop hide/show using macOS-safe APIs or `chflags`.
- Hide or replace the Windows shutdown button.

Deferred unless Phase 2 is easy:

- System audio transcription.
- Full screen recording and MP4 conversion.
- Auto updater.
- Cross-platform Windows replacement.

Deliverable:

- Internal macOS `.app` and `.dmg` candidate for Apple Silicon.

Verification:

- Installed app launches from `/Applications`.
- User grants Screen Recording permission when requested.
- Capture -> mosaic -> save edited PNG passes.
- Original capture is not overwritten by default.
- Desktop cleanup -> restore passes.
- App quit restores hidden desktop files or warns before quit.
- No paid AI call is made during default smoke.

### Phase 3 - Paid/API And Recording Hardening

Purpose: bring advanced features up to production quality.
Scope:

- API key storage decision.
- Cost confirmation UI for paid AI actions.
- Claude/OpenAI error handling and retry guard.
- Recording format support.
- Bundled or sidecar ffmpeg strategy.

Deliverable:

- Advanced feature pass/fail matrix.
- Updated user-facing copy for paid AI operations.

Verification:

- No API key appears in logs, reports, GitHub, or shared handoffs.
- Paid features show explicit provider/model/action/cost warning before submit.
- Failed paid submit preserves a sanitized diagnostic path and does not auto-retry.
- Recording save passes on installed Mac app, or the feature remains disabled with clear copy.

### Phase 4 - AIMAX Production Catalog Integration

Purpose: expose Mac Jieun in AIMAX safely.
Scope:

- Upload Mac artifact to Oracle downloads.
- Add Mac download URL to worker catalog.
- Change Jieun supported platforms from Windows-only to Windows + macOS.
- Keep Windows v0.1.6 links intact.
- Update worker catalog smoke tests and admin display.

Deliverable:

- AIMAX app shows Jieun download on Mac.
- Windows users still see the Windows installer.

Verification:

- `node --check oracle/aimax-reports-api/server.js`
- worker catalog smoke passes.
- HTML inline script parse passes.
- `/api/workers` returns both platform paths.
- Mac user UI offers Mac download.
- Windows user UI offers Windows download.
- Unsupported/unknown platform copy remains clear.

## Electron To Tauri Feature Map

| Existing Electron surface | Tauri direction | MVP status |
|---|---|---|
| `ipcMain` + preload `viseobarAPI` | Tauri `#[tauri::command]` + `invoke` wrapper | Required |
| Transparent always-on-top character window | Tauri window config and window APIs | Required |
| Multi-window renderer pages | Tauri webview windows with labels | Required |
| Capture overlay | Tauri window plus Rust capture command | Required |
| `desktopCapturer` screenshot | Rust native capture spike | Required |
| Clipboard image/write text | Tauri clipboard plugin or Rust clipboard crate | Required |
| Save dialogs | Tauri dialog plugin | Required |
| Desktop hide/show | Rust filesystem + macOS `chflags` fallback | Required |
| Tesseract local OCR | Prefer Rust command wrapping current tessdata strategy or keep JS worker if stable | Required/Spike |
| Memo store | Tauri store plugin or app data file | Required |
| Open external URL | Tauri opener plugin | Required |
| Recording overlay/frame | Tauri windows; capture stream needs spike | Defer if risky |
| ffmpeg conversion | Tauri sidecar/external binary | Defer to Phase 3 |
| Windows shutdown | Hide on macOS or replace with Mac sleep/shutdown after approval | Do not ship as-is |
| Electron autoUpdater | Tauri updater or manual download | Defer |

## macOS-Specific Product Decisions

1. First target is Apple Silicon only.
   - AIMAX Local Agent already treats Intel Mac as unsupported until universal2 is deliberately built.
   - Keep Jieun aligned with that policy unless there is a user need for Intel.

2. First Mac version should be `v0.1.7-mac-alpha` internally or `v0.2.0` if we want to signal a framework migration.
   - Recommendation: `0.2.0-tauri-alpha` for source branch testing, then release as `0.2.0` after verification.

3. Do not expose a Mac download in production before installed-app verification.
   - Tauri dev success is not enough because macOS screen/capture permissions differ after packaging.

4. Windows shutdown button must not appear on Mac.
   - Alternative label, if implemented later: `Mac 잠자기`.
   - Full Mac shutdown should require a separate explicit approval because it can close user work.

5. Paid AI features should be disabled or guarded during the first Mac smoke.
   - Memo summary, OCR via Claude Vision, and Whisper transcription can incur external API costs.
   - Default smoke must use no-cost local paths first.

## Implementation Checklist For `aimax-viseo`

### Branch Setup

- Create branch `feature/jieun-tauri-macos-v017`.
- Confirm current source includes:
  - mosaic editor changes from PR #2
  - multi-display capture fix from PR #3
  - Windows shutdown feature from PR #4, or intentionally reimplement only the relevant behavior.

### Tauri Scaffold

- Add Tauri dependencies and scripts.
- Add `src-tauri/Cargo.toml`.
- Add `src-tauri/tauri.conf.json`.
- Configure initial window:
  - transparent
  - decorationless/floating
  - always-on-top
  - skip taskbar/dock behavior if supported and appropriate
- Configure CSP and capabilities narrowly.

### Frontend Compatibility Layer

- Replace direct Electron preload dependency with a local API wrapper:
  - `expandMenu`
  - `collapseMenu`
  - `openMemo`
  - `closeMemo`
  - `dragWindow`
  - `openCaptureOverlay`
  - `captureRegion`
  - `saveEditedCapture`
  - `copyEditedCapture`
  - `getDesktopStatus`
  - `hideDesktop`
  - `showDesktop`
  - `openBlog`
  - `quitApp`
- Keep component code changes small by preserving the existing function names where possible.

### Rust Command Modules

Recommended module split:

- `commands/window.rs`
- `commands/capture.rs`
- `commands/desktop.rs`
- `commands/memo.rs`
- `commands/clipboard.rs`
- `commands/external.rs`
- `commands/recording.rs` later

Command return values should use structured result objects similar to the current Electron responses:

- `{ success: true, ... }`
- `{ success: false, reason: "..." }`

### macOS Packaging

- Build app and DMG using Tauri CLI.
- Keep unsigned/internal build for first local test only.
- For customer download, plan code signing and notarization.
- Record:
  - artifact filename
  - file size
  - SHA256
  - Apple architecture
  - macOS version
  - exact smoke results

## AIMAX Catalog Changes After Mac Artifact Exists

Files likely touched:

- `oracle/aimax-reports-api/server.js`
- `oracle/aimax-reports-api/static/app.html`
- `oracle/aimax-reports-api/static/admin.html` if admin labels need platform-specific URL display
- `scripts/smoke_worker_catalog_contract.mjs`
- `scripts/deploy_oracle.sh`
- deployment report under `docs/deployments/`

Possible catalog shape:

```js
supportedPlatforms: ["windows", "macos"],
setupDownloadUrl: `${PUBLIC_BASE_URL}/downloads/AIMAX-Office-Manager-Setup-0.1.6.exe`,
portableDownloadUrl: `${PUBLIC_BASE_URL}/downloads/AIMAX-Office-Manager-portable.exe`,
macDownloadUrl: `${PUBLIC_BASE_URL}/downloads/AIMAX-Office-Manager-mac-0.2.0.dmg`,
downloadLabel: "Setup exe 다운로드",
macDownloadLabel: "Mac DMG 다운로드",
version: "0.2.0"
```

The actual field names should follow existing AIMAX frontend patterns. If current UI only supports one `setupDownloadUrl`, add a platform-aware external employee download helper rather than overloading the Windows URL.

## Gate Before Starting Source Rewrite

Before editing `aimax-viseo`, confirm:

1. Should the Tauri version replace Electron for all future Jieun builds, or only create a Mac lane first?
2. Should the first Mac target be Apple Silicon only?
3. Should recording be included in the first MVP, or deferred?
4. Should paid AI memo/transcription features be disabled during first Mac alpha?
5. Should Mac shutdown/sleep exist, or should the Windows shutdown button simply be hidden?

Recommended answers:

1. Mac lane first, keep Windows Electron v0.1.6 stable.
2. Apple Silicon only.
3. Defer recording.
4. Disable paid AI by default in first smoke.
5. Hide shutdown on Mac for MVP.


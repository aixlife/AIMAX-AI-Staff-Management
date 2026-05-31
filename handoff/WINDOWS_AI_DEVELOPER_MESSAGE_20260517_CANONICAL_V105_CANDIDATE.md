# WINDOWS AI DEVELOPER MESSAGE - 2026-05-17 CANONICAL v1.0.5 CANDIDATE

## Purpose

Build and verify a Windows `v1.0.5` candidate from the Mac canonical source after the 2026-05-17 stability merge.

This is not a feature build. It is a release-gate verification build to ensure the Windows fixes from `v1.0.4` are now represented in canonical source and do not depend on a stale local Windows build tree.

## Source

Use this ZIP from the shared folder:

```text
aimax-canonical-v105-source-20260517.zip
SHA256: 9be418b6150750c3df3be0c09df85d83aa7bd0da0d111995a30bdf04f1acc6ed
```

Important:

- Copy the ZIP out of Syncthing into a local Windows work folder before extracting.
- Do not build inside the Syncthing shared folder.
- Use a clean extraction folder. Do not overlay this ZIP onto an older Windows build tree.
- Do not bring old `split_version/content` mirror files into this candidate. The canonical source intentionally imports shared root `content/*`.
- Keep secrets, passphrases, API keys, cookies, browser profiles, and local credentials out of Syncthing.

## Expected Version

- App runtime: `v1.0.5`
- Inno `AppVersion`: `1.0.5`
- Returned installer filenames may remain:
  - `aimax-bundle-windows.exe`
  - `aimax-yeri-windows.exe`
  - `aimax-hyunju-windows.exe`

## What Changed From Canonical Merge

- Added `AiGenerationError` and `AiQuotaError` compatibility classes to `content.ai_text`.
- Added hidden diagnostics probe import smoke for:
  - `generate_blog_content`
  - `measure_visible_char_count`
- Added browser session recovery markers:
  - `target frame detached`
  - `frame detached`
  - `no such window`
- Added one retry around early Naver login/browser startup close.
- Added early single-instance lock handoff, with runtime adjusted so the early lock is not reacquired by the same process.
- Added native Go launcher source:
  - `packaging/windows/aimax_agent_launcher.go`
- Updated Windows installer to launch through:
  - `aimax-agent-launcher.exe`
- Updated app/installer version to `v1.0.5`.

## Required Windows Checks

### Build Cleanliness

- Confirm the source was extracted into a clean local folder outside Syncthing.
- Confirm there is no old `split_version/content` folder carried over from a previous build tree.
- Confirm no `.env`, credentials, passphrases, browser profiles, or decrypted local data are present.

### Toolchain

- Confirm Go is installed and `aimax-agent-launcher.exe` is built.
- Confirm Inno Setup is available for installer packaging.
- If Go is missing, report a blocker. Do not bypass the native launcher by pointing the installer directly to the core EXE.

### Build Artifacts

Build all three Windows installers:

- bundle
- Yeri write
- Hyunju find

Each installed app folder must contain:

- the core EXE
- `aimax-agent-launcher.exe`
- Tcl/Tk runtime files
- bundled `content.ai_text`

### Diagnostics Probe

Run `--diagnostics-probe` on:

- built onedir bundle
- built onedir Yeri
- built onedir Hyunju
- installed bundle from a Korean/special-character path
- installed Yeri from a Korean/special-character path
- installed Hyunju from a Korean/special-character path

Required result:

```text
ai_text_import_smoke.ok = true
has_generate_blog_content = true
has_measure_visible_char_count = true
sample_visible_char_count = 13
```

### Native Launcher / Protocol

Verify:

- direct launcher repeated 20 times keeps max launcher process count at 1
- direct launcher repeated 20 times keeps max core process count at 1
- `aimax://agent/connect` repeated 5 times uses `aimax-agent-launcher.exe`
- protocol command points to installed `aimax-agent-launcher.exe`, not the core EXE
- request file source is `native-go-launcher`

### Local Settings / Tk

Verify:

- local settings dialog opens 10 times
- save, cancel, and X-close paths all work
- no `application has been destroyed`
- no missing `tk.tcl` / Tcl/Tk runtime error

### Yeri Browser/Image No-Cost Smoke

No paid API test. No real Naver posting.

Use mocked/no-cost smoke for:

- happy path write
- `target frame detached` recovery
- early login window close / `no such window` recovery
- image requested 3 / inserted 0 should fail cleanly at `smart_editor_input` with attempted/generated/inserted counts

### Heartbeat / Queued Job Smoke

Use fake/local client only. Confirm:

- queued job can transition `running` -> `done`
- active job id is cleared after completion
- worker completion does not leave a permanent waiting/queued symptom

## Return To Shared Folder

Return these files:

- `WINDOWS_AI_COMPLETION_REPORT_20260517_CANONICAL_V105_CANDIDATE.md`
- `aimax-bundle-windows.exe`
- `aimax-yeri-windows.exe`
- `aimax-hyunju-windows.exe`
- `windows-source-delta-20260517-canonical-v105.zip`
- `SHA256SUMS.txt`

Completion report must include:

- exact build folder path, noting it was outside Syncthing
- tool versions: Python, PyInstaller, Go, Inno Setup
- SHA256 for every returned artifact
- diagnostics probe results
- launcher/protocol test results
- local settings/Tk results
- no-paid/no-real-Naver confirmation
- code-signing status
- blockers, if any

## Stop Conditions

Stop and return a blocker report if:

- `aimax-agent-launcher.exe` cannot be built
- installed probe cannot import `measure_visible_char_count`
- protocol uses the core EXE instead of the launcher
- local settings repeatedly fails on Windows
- installer version/runtime version is not `v1.0.5`

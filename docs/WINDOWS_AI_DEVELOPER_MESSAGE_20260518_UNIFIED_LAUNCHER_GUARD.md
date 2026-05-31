# Windows AI Developer Message - 2026-05-18 Unified Launcher Guard

## Context

We found a confusing production case:

- Account: `demo@aimax.ai.kr`
- Entitlement: `bundle`
- Entitlement products: `["yeri", "hyunju", "bundle"]`
- Server `can_execute`: `true`
- But the connected local agent reported:
  - `yeri_write = unavailable`
  - `hyunju_find = ready`

Root cause: a split/local app was connected instead of the unified bundle app. On macOS this was `AIMAX-Find.app`, but the same class of issue can happen on Windows if a split Yeri/Hyunju executable, old shortcut, or protocol registration captures a bundle account.

The user experience is bad: the customer believes they installed the correct app, but the web console says one employee is unavailable.

Mac/Oracle quick fix has already been deployed:

- Bundle users now see only the unified installer in the web app download list.
- If a bundle user is connected to a split-looking agent, the web app says the entitlement is normal and asks them to run the unified installer.
- macOS unified bundle was rebuilt from the current source and deployed to Oracle:
  - `aimax-bundle-macos.dmg`
  - SHA256 `090b679e4c1f9ecc7e4bf31773f71288c95ef4dbb95fed7f15acfd069eded161`
  - Runtime diagnostics: `version=v1.0.5`, `mode=all`, `frozen=true`
  - Added Keychain read timeout so a new macOS bundle cannot silently hang while waiting for old Keychain permission.

Windows must now make this impossible or very hard at the OS/agent level.

The handoff folder includes the current sanitized Mac-side source snapshot:

- `aimax-unified-launcher-guard-source-20260518.zip`
- `aimax-unified-launcher-guard-source-20260518.zip.sha256`

Copy the source ZIP out of Syncthing into a local Windows work folder before building.

## Goal

Prepare a Windows `v1.0.6` rebuild that prevents split executables from silently serving bundle accounts and makes `aimax://agent/connect` prefer the unified bundle launcher.

## Required Behavior

### 1. Bundle account + unified bundle executable

When a bundle account uses `aimax-bundle-windows.exe` / installed unified app:

- Agent heartbeat must report both workers usable when local settings are ready:
  - `yeri_write = ready`
  - `hyunju_find = ready`
- Web job creation/claim flow must support both Yeri and Hyunju.
- Existing v1.0.5 fixes must remain intact.

### 2. Bundle account + split executable

When a bundle account launches or connects through a split executable:

- Do not quietly heartbeat as a normal connected split agent with one worker `unavailable`.
- Show a clear local message:
  - Korean: `이 계정은 통합 권한입니다. AIMAX 통합 실행기를 사용해주세요.`
  - Include a short explanation that the current split executable cannot run all employees.
- Prefer one of these safe outcomes:
  1. Forward/open the installed unified bundle launcher, if present.
  2. Otherwise open the web app Updates/installer path or tell the user to install the unified app.
- The split executable may remain usable for true Yeri-only or Hyunju-only accounts, but it must not trap a bundle account.

### 3. Protocol ownership

`aimax://agent/connect` must not be captured by a split executable when the unified app is installed.

Validation scenarios:

- Install split first, then bundle: protocol should open/route to bundle.
- Install bundle first, then split: split installer must not steal protocol ownership from bundle, or must forward to bundle.
- Repeated `aimax://agent/connect` calls should preserve the native single-instance guarantee.

### 4. Heartbeat diagnostics

Add lightweight diagnostics to heartbeat/logs where practical:

- app mode or build flavor: `bundle`, `yeri`, `hyunju`
- provided workers
- entitlement product seen from login/session, if available
- whether a bundle-account/split-executable mismatch was detected

Do not include secrets, session tokens, Naver credentials, API keys, cookies, or signed URLs in logs or handoff files.

### 5. Versioning

If any Windows executable or installer behavior changes, bump Windows runtime and installer version to:

- `v1.0.6`
- Inno Setup `AppVersion=1.0.6`
- Runtime diagnostics should report `system.app.version = v1.0.6`

## Validation Required

Run all tests without real publishing and without paid model/API generation.

Minimum Windows validation:

1. Fresh install unified bundle:
   - Login bundle-capable test account.
   - Verify heartbeat workers can become `yeri_write=ready`, `hyunju_find=ready`.
   - Verify web can queue/claim a mocked Yeri job and a mocked Hyunju job.

2. Split app mismatch:
   - Launch Yeri-only split executable with a bundle account.
   - Launch Hyunju-only split executable with a bundle account.
   - Verify a clear local message or automatic forwarding to bundle.
   - Verify it does not leave the web app in a misleading `bundle entitlement + yeri_write/hyunju_find unavailable` state.

3. Protocol routing:
   - Install split then bundle.
   - Install bundle then split.
   - Trigger `aimax://agent/connect` repeatedly.
   - Verify unified launcher wins or split forwards to unified bundle for bundle accounts.
   - Verify process count remains single-instance.

4. Regression:
   - `open_settings` still opens without Tk lifecycle errors.
   - Windows native Go launcher guard still prevents duplicate core processes.
   - v1.0.5 import/initialization fixes remain intact.

## Return Artifacts

Return all artifacts to the Syncthing handoff folder, not inside a Windows build folder:

- `WINDOWS_AI_COMPLETION_REPORT_20260518_UNIFIED_LAUNCHER_GUARD.md`
- `windows-source-delta-20260518-unified-launcher-guard-v106.patch`
- `aimax-bundle-windows.exe`
- `aimax-yeri-windows.exe`
- `aimax-hyunju-windows.exe`
- `SHA256SUMS.txt`
- `aimax-windows-unified-launcher-guard-evidence-20260518.json`

Completion report must include:

- exact changed files
- version values confirmed
- SHA256 for all returned installers and patch
- protocol ownership test result
- bundle account + split executable mismatch test result
- bundle executable both-worker test result
- residual risks or blockers

## Notes

- Do not build inside the shared Syncthing folder.
- Copy sources into a local Windows work folder first.
- Keep secrets/passphrases/tokens out of Syncthing.
- Use the latest Windows `v1.0.5` source/work folder as the base unless a newer Windows source handoff exists.
- If your existing Windows work folder is older than this handoff, compare it with the provided source ZIP before implementing the guard.
- No paid API/model/generation tests.

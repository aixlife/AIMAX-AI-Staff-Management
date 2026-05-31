# Windows Handoff: R3-T Installer And Launcher Visibility

## Context

R3-R live rollout completed with Windows `v1.0.28`, but a real Windows user reported that the AIMAX runner would not open after deployment.

Latest report:
- Report id: `AIMAX-RPT-20260527154717-2f9f8f86`
- Account: masked in server report, do not expose customer credentials
- Platform: Windows web UI
- Work context: `실행기가 열리지 않음`
- Server evidence: this account has no runner heartbeat and no agent entry, so the failure is before server connection.

During remote reinstall, the user also observed that after clicking run/install, it is not clear whether installation or launch is progressing. This is now treated as a separate R3-T hotfix: the Windows installer and launcher must be visibly understandable to a normal user.

Additional remote evidence from the affected Windows machine:
- All `aimax-bundle-windows.exe` / `AIMAX` related processes were later terminated successfully.
- One prior installer process existed with no window title, and Windows reported `Responding = True`.
- No `aimax://` protocol registration was present after that attempt.
- AIMAX did not appear in the installed app list.
- No useful temporary installer log, Windows Application event, or Defender block event was found.
- The installer is Inno Setup based and is currently unsigned.

Follow-up remote evidence:
- The installer was explicitly launched with `/LOG`, for example:
  - `"C:\Users\user\Downloads\aimax-bundle-windows.exe" /LOG="C:\Users\user\AppData\Local\Temp\aimax-install-20260528-010745.log"`
- Result:
  - no installer window
  - no log file created
  - still running after more than 45 seconds
  - no `aimax://` protocol registration
  - no AIMAX installed-app entry
  - only a background setup process remained, which was manually terminated

This means the affected machine is hanging before normal Inno Setup logging/wizard initialization. Treat the current `v1.0.28` installer as suspect on this environment until a hash/signature/security check and a freshly rebuilt diagnostic installer prove otherwise.

This means R3-T must cover not only post-install launcher silence, but also an installer process that can become titleless/hidden before protocol registration or app registration completes.

## Current Code Signals

The relevant current files are included in `source-files/`:
- `packaging/windows/aimax_installer.iss`
- `packaging/windows/aimax_agent_launcher.go`

Important current behavior:
- The installer has a post-install run step:
  - `Filename: "{app}\{#LauncherExeName}"; ... Flags: nowait postinstall skipifsilent`
- The Go launcher uses the mutex `Local\AIMAX.LocalAgent`.
- If another launcher/agent instance is already running, it writes the request and returns silently.
- If core exe detection or process start fails, it exits without a visible Korean message.
- The child process is started with `HideWindow: true`, so launch failure or long startup can look like nothing is happening.

## Phase

R3-T: Windows installer/launcher visibility and pre-heartbeat diagnostics.

Target version:
- Prefer Windows `v1.0.29`.
- If you must use another patch version, state it explicitly in the result.

## Required Changes

Implement a Windows-side fix so users are never left with an invisible install/launch state.

1. Installer visibility
- Keep the Inno installer wizard visible with clear Korean progress/completion text.
- The finish page launch action must communicate that AIMAX is being opened.
- Do not make the post-install launch feel like a no-op.
- Keep non-admin install behavior under LocalAppData.
- Confirm the setup process never sits titleless/hidden for more than 30 seconds in normal launch.
- If a stale setup process is detected or a second installer launch happens while one is already running, the user must receive a visible Korean message or the installer must recover cleanly.
- Add a support/debug path for installer logging. At minimum, document and verify running the installer with Inno `/LOG`, and return the captured log when reproducing the hidden/titleless installer case.
- If unsigned installer / SmartScreen behavior appears relevant, capture it as evidence. Do not treat code signing as solved unless a signed installer is actually produced and verified.
- If `/LOG` produces no file and the setup process stays hidden/titleless, mark that as an installer bootstrap blocker. Do not claim this is fixed by launcher-only changes.
- Verify the affected/downloaded installer SHA256 against the official deployed hash before retrying. Current live Windows `v1.0.28` SHA256 from R3-R was `c0d95b51750c6994417d859eb864a65b600e66ec5ccf459644866cd8f3a2de54`.
- Capture `Get-AuthenticodeSignature` result and whether a `Zone.Identifier` stream exists on the downloaded installer. If you test `Unblock-File`, state that clearly and do not hide it as a normal user path.
- Produce a fresh `v1.0.29` installer from a clean Windows build output. If possible, also produce a diagnostic build or support recovery path that can prove whether the problem is packaging/security/bootstrap versus local runner code.

2. Launcher visibility
- `aimax-agent-launcher.exe` must not fail silently.
- When AIMAX is already running, show clear Korean guidance such as:
  - AIMAX is already running.
  - Check the taskbar or hidden tray icons.
  - Return to the web page and click connect/settings again if needed.
- When the core executable is missing, start fails, or the process exits too quickly, show a clear Korean error dialog.
- The user-visible error must be actionable and mention that an error report can be sent from the web UI.
- Keep protocol requests and settings requests compatible with the existing request file behavior.

3. Diagnostics
- Add a sanitized launcher diagnostics file under a non-legacy AIMAX folder, for example:
  - `%APPDATA%\AIMAX\launcher_diagnostics\launcher_YYYYMMDD.jsonl`
- Record only non-secret fields:
  - timestamp
  - launcher version/build if available
  - stage, for example `launcher_started`, `request_written`, `mutex_already_running`, `core_detected`, `core_start_failed`, `core_exited_quickly`
  - sanitized error code/message
  - whether protocol url was present, without logging full secrets or signed URLs
- Preserve the existing `%APPDATA%\NaverBlogAuto\aimax-local-agent-request.json` compatibility unless the local agent is also updated to read a new location.

4. No regressions
- Do not reintroduce installer `DeleteFile failed code 5/access denied` on `aimax-agent-launcher.exe`.
- Do not break:
  - `aimax://agent/connect`
  - `aimax://agent/open-settings`
  - local settings save/open-settings
  - legacy AppData self-heal
  - runner-start watchdog / `runner_start_timeout`
  - frozen runtime packaging

## Required No-Paid Verification

Run these on Windows with the installed bundle, not source-only mode:

1. Clean install
- User can see installation progress.
- Finish page is understandable.
- Launching after install gives visible feedback and opens/starts AIMAX.
- Web dashboard/settings receives current runtime heartbeat.
- No hidden/titleless installer process remains after install completion.
- `aimax://` protocol registration is present after install.
- AIMAX appears in the installed app list or the installer result clearly explains why LocalAppData/per-user install is represented differently.

2. Reinstall over existing install
- No `DeleteFile failed code 5/access denied`.
- If AIMAX is running, installer behavior is understandable and recoverable.
- If a stale/hidden setup process exists, the retry path is visible and deterministic.

2a. Installer log reproduction
- Run the installer at least once with an explicit Inno `/LOG` path.
- Include a sanitized summary of the log.
- If the installer can be made hidden/titleless, return the log and exact reproduction steps.
- If no `/LOG` file is created at all, return:
  - exact command
  - process name/PID
  - elapsed time before termination
  - process window title/main window handle if available
  - file SHA256
  - Authenticode signature status
  - Zone.Identifier presence
  - whether SmartScreen/security UI appeared

3. Shortcut and protocol launch
- Desktop/start menu shortcut is user-visible.
- `aimax://agent/connect` reaches the current runtime.
- `aimax://agent/open-settings` reaches current runtime or displays a clear already-running/opening message.

4. Already-running case
- Launching a second time does not silently disappear.
- Request file is still written.
- User receives guidance instead of no visible result.

5. Failure simulation
- Temporarily simulate missing core exe or blocked start in a local test copy.
- Confirm a Korean error dialog appears.
- Confirm diagnostics file records the stage/error.

6. Regression smokes
- `ai_text_import_smoke.ok == true`
- `browser_version_detection.ok == true`
- installed runner frozen runtime is true
- update recognition reports current patch with `update_required=false` in the test config
- no paid AI/Apify/Naver publish/schedule/edit/save/customer credentials/secrets/live deploy/Oracle version API change

## Return Files

Return these files to this same Shared-Bridge folder:

- `WINDOWS_RESULT_20260528_r3t_installer_launch_visibility.md`
- `aimax_r3t_v129_installer_launch_visibility_diag.json`
- `aimax-bundle-windows.exe`
- `NEXT_TRIGGER_20260528_r3t_installer_launch_visibility.json`

If blocked, return a narrow blocker report and do not claim pass.

## Result Format Requirements

The result Markdown must include:
- exact Windows version/patch
- installer SHA256
- evidence summary for clean install/reinstall/shortcut/protocol/already-running/failure simulation
- screenshot paths or visible-text evidence where available
- final verdict: pass or blocked
- any remaining user-facing risk

The diagnostic JSON must include booleans or structured fields for every required verification item above.

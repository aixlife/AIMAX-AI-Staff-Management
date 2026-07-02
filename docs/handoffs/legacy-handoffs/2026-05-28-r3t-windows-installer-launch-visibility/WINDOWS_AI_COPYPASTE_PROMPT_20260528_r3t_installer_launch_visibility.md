Read the latest handoff docs in the Shared-Bridge folder first:

`2026-05-28-r3t-windows-installer-launch-visibility/WINDOWS_HANDOFF_20260528_r3t_installer_launch_visibility.md`

Task: implement and verify R3-T Windows installer/launcher visibility and pre-heartbeat diagnostics.

Important:
- Copy source out of Syncthing into a local Windows work folder before editing/building.
- Do not build inside the shared folder.
- Keep secrets, passphrases, browser profiles, cookies, and customer credentials out of Syncthing.
- Use the included `source-files/packaging/windows/aimax_installer.iss` and `source-files/packaging/windows/aimax_agent_launcher.go` as current context.

Goal:
- Produce Windows `v1.0.29` unless a different patch version is explicitly justified.
- Fix the user-visible problem where install/launch can look like nothing is happening.
- The installer must show clear progress/completion.
- `aimax-agent-launcher.exe` must not silently exit on already-running, missing core exe, start failure, or quick-exit cases.
- Add sanitized launcher diagnostics under an AIMAX AppData folder while preserving existing request-file compatibility.

New affected-user evidence:
- A previous `aimax-bundle-windows.exe` process existed with no window title while Windows showed `Responding = True`.
- No `aimax://` protocol registration was created.
- AIMAX was not listed as installed.
- No useful temp install log, Application event, or Defender block event was found.
- The installer is Inno Setup based and unsigned.
- A follow-up `/LOG` test also produced no log file at all:
  - no installer window
  - still running after 45+ seconds
  - no protocol registration
  - no installed-app entry
  - only a background setup process remained and had to be terminated

This is now an installer bootstrap/pre-Inno-log hang. Do not claim a launcher-only change fixes this.

So R3-T must also handle or diagnose installer-hidden/titleless pre-registration hangs, not only post-install launcher silence.

Required Windows installed-user verification:
- Clean install shows visible progress and launches/starts AIMAX visibly.
- Clean install does not leave a hidden/titleless installer process.
- `aimax://` protocol registration exists after install.
- AIMAX appears in installed apps, or the result clearly explains the per-user LocalAppData install representation.
- Reinstall over existing/running AIMAX has no `DeleteFile failed code 5/access denied`.
- Reinstall while a stale setup process is present either recovers or gives a visible Korean message.
- Run the installer once with explicit Inno `/LOG`, include a sanitized installer log summary, and if hidden/titleless setup can be reproduced, return exact reproduction steps and the log.
- If `/LOG` creates no file, return that as a blocker/evidence item with exact command, PID/process name, elapsed time, file SHA256, Authenticode signature status, Zone.Identifier presence, and whether SmartScreen/security UI appeared.
- Before retrying the affected file, verify SHA256. Current live Windows `v1.0.28` expected SHA256: `c0d95b51750c6994417d859eb864a65b600e66ec5ccf459644866cd8f3a2de54`.
- Capture `Get-AuthenticodeSignature` and `Zone.Identifier` state for the downloaded installer.
- Produce a fresh `v1.0.29` installer from clean build output. If feasible, also provide a diagnostic/support recovery installer or bundle that can distinguish packaging/security/bootstrap failure from runner code failure.
- Dashboard/settings receives heartbeat from current installed runtime.
- `aimax://agent/connect` and `aimax://agent/open-settings` reach current runtime or show clear user-visible already-running/opening guidance.
- Already-running launch writes the request file and shows guidance instead of disappearing.
- Missing-core/start-failure simulation shows a Korean error dialog and writes launcher diagnostics.
- Local settings save/open-settings, legacy AppData self-heal, runner-start watchdog behavior, `ai_text_import_smoke.ok`, and `browser_version_detection.ok` still pass.
- Frozen runtime remains true.
- Update recognition reports current patch with `update_required=false` in the test config.

Forbidden:
- No paid AI generation.
- No Apify.
- No Naver publish/schedule/edit/save mutation.
- No customer credentials or secrets.
- No duplicate paid retry.
- No live deploy.
- No Oracle version API change.

Return these files to the same Shared-Bridge folder:
- `WINDOWS_RESULT_20260528_r3t_installer_launch_visibility.md`
- `aimax_r3t_v129_installer_launch_visibility_diag.json`
- `aimax-bundle-windows.exe`
- `NEXT_TRIGGER_20260528_r3t_installer_launch_visibility.json`

If blocked, return a narrow blocker report and whether the issue can be resumed without rebuilding from scratch.

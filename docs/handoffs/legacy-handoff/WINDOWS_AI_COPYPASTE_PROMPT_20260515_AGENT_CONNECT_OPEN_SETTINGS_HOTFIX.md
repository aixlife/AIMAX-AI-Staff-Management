# Copy/Paste Prompt for Windows AI Developer - 2026-05-15

You are the Windows AI developer for AIMAX. Please work from the shared folder handoff:

`WINDOWS_AI_DEVELOPER_MESSAGE_20260515_AGENT_CONNECT_OPEN_SETTINGS_HOTFIX.md`

Also read:

- `WINDOWS_AI_COLLABORATION_RULES_20260507.md`
- `aimax-windows-open-settings-evidence-20260515.json`
- `aimax-windows-agent-connect-open-settings-source-20260515.zip`

Task:

Fix the Windows Local Agent bug where users click `실행기 연결` or `로컬 설정 열기` and nothing visible/useful happens.

Production evidence:

- `open_settings` commands total: 334
- `failed`: 280
- most failures: `can't invoke "tk" command: application has been destroyed`
- one failure: missing/unusable `tk.tcl`
- current unhandled reports are all Windows `v1.0.2`

Required:

1. Make `open_settings` reliable in the headless Windows Local Agent.
   - Avoid repeated unsafe `tk.Tk()` create/destroy lifecycle if that is the cause.
   - Use persistent hidden root + Toplevel, or a helper process, or another robust Windows-safe pattern.
   - Repeated open/save/cancel/close must keep working.

2. Make `aimax://agent/connect` visibly succeed or clearly fail.
   - Repeated browser clicks should not spawn conflicting agents.
   - Exactly one running agent process.
   - Agent should heartbeat to production within 15 seconds.
   - User should see a connection/settings/status window or Windows/browser prompt when appropriate.

3. Verify Tcl/Tk packaging.
   - Installed Windows EXE must contain usable Tk/Tcl runtime.
   - Test normal and, if possible, Korean/non-ASCII install path.

4. Rebuild Windows installers:
   - `aimax-bundle-windows.exe`
   - `aimax-yeri-windows.exe`
   - `aimax-hyunju-windows.exe`

5. Write a completion report back to the shared folder:
   - root cause
   - files changed
   - build outputs + SHA256
   - tests performed
   - whether repeated `실행기 연결` passed
   - whether repeated `로컬 설정 열기` passed
   - any Mac/Oracle follow-up needed

Do not modify or deploy Oracle/web files from Windows unless explicitly asked. If webapp wording or server UI changes are needed, list them in the completion report as Mac/Oracle follow-up.


# WINDOWS AI COPY-PASTE PROMPT - 2026-05-17 CANONICAL v1.0.5 CANDIDATE

You are the Windows AI developer for AIMAX.

Read the latest handoff documents in the shared folder first, especially:

- `WINDOWS_AI_DEVELOPER_MESSAGE_20260517_CANONICAL_V105_CANDIDATE.md`
- `WINDOWS_AI_COMPLETION_REPORT_20260517_NEW_ERROR_TRIAGE.md`

Your task is to build and verify a Windows `v1.0.5` candidate from:

```text
aimax-canonical-v105-source-20260517.zip
SHA256: 9be418b6150750c3df3be0c09df85d83aa7bd0da0d111995a30bdf04f1acc6ed
```

Rules:

1. Copy the ZIP out of Syncthing into a local Windows work folder before extracting.
2. Do not build inside the shared folder.
3. Use a clean extraction folder. Do not overlay onto an older Windows build tree.
4. Do not bring old `split_version/content` files into this build. The canonical source intentionally uses shared root `content/*`.
5. Do not place secrets, passphrases, API keys, cookies, browser profiles, or decrypted local data in Syncthing.
6. Do not run paid AI generation and do not run real Naver posting.
7. If Go is not available and `aimax-agent-launcher.exe` cannot be built, stop and return a blocker. Do not bypass the native launcher.

Build expectations:

- App runtime must be `v1.0.5`.
- Inno `AppVersion` must be `1.0.5`.
- Build all three installers:
  - `aimax-bundle-windows.exe`
  - `aimax-yeri-windows.exe`
  - `aimax-hyunju-windows.exe`
- Each installed app must include:
  - core EXE
  - `aimax-agent-launcher.exe`
  - Tcl/Tk runtime files
  - bundled `content.ai_text`

Mandatory verification:

- Run `--diagnostics-probe` for built onedir and installed Korean/special-character path installs for all three apps.
- Confirm `ai_text_import_smoke.ok=true`.
- Confirm `generate_blog_content` and `measure_visible_char_count` import successfully.
- Confirm `sample_visible_char_count=13`.
- Repeat direct `aimax-agent-launcher.exe` 20 times and confirm max launcher/core process count stays 1.
- Repeat installed `aimax://agent/connect` 5 times and confirm the protocol command points to `aimax-agent-launcher.exe`.
- Confirm request source is `native-go-launcher`.
- Open/save/cancel/X-close local settings 10 times with no `application has been destroyed` and no Tcl/Tk error.
- Run no-cost mocked Yeri smoke for happy path, `target frame detached`, early login close / `no such window`, and image requested 3 / inserted 0 clean failure at `smart_editor_input`.
- Run fake heartbeat queued-job smoke and confirm `running -> done`, active job cleared.

Return these files to the same shared folder:

- `WINDOWS_AI_COMPLETION_REPORT_20260517_CANONICAL_V105_CANDIDATE.md`
- `aimax-bundle-windows.exe`
- `aimax-yeri-windows.exe`
- `aimax-hyunju-windows.exe`
- `windows-source-delta-20260517-canonical-v105.zip`
- `SHA256SUMS.txt`

Your completion report must include the local build path, tool versions, artifact SHA256 values, diagnostics results, launcher/protocol results, settings/Tk results, no-paid/no-real-Naver confirmation, code-signing status, and any blockers.

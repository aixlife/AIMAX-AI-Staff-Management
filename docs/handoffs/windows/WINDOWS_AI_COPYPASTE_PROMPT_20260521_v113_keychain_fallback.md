Read first:
WINDOWS_HANDOFF_20260521_v113_keychain_fallback.md

Goal:
Review and, if appropriate, build a Windows `v1.0.13` candidate for the AIMAX unified Windows runner that includes credential/session fallback behavior from the macOS v1.0.6 keychain hotfix.

Important:
- Use `source_delta/` only as reference for the common code changes.
- Do not copy Mac `APP_VERSION=v1.0.6` into Windows output. Windows target is `v1.0.13`.
- Preserve all Windows `v1.0.12` fixes, especially the editor `image_provider` contract fix.
- Do not send customer data, API keys, cookies, `.env`, browser profiles, signed URLs, or raw private logs to any AI reviewer.
- Do not run paid AI calls or real Naver publish/save tests.
- Claude/Gemini, if available, are advisory reviewers only.

Suggested checks:
1. Confirm whether the Windows work folder is a Git checkout.
2. Inspect diffs before editing.
3. Apply the fallback logic:
   - web agent session fallback file
   - settings secret fallback file
   - keychain/credential unavailable handling
   - Korean `invalid_credentials` explanation with whitespace hint
   - password input `.strip()` in GUI/headless connect paths
4. Run no-paid tests:
   - py_compile
   - fallback save/load with credential store disabled
   - mocked invalid credentials
   - mocked token-save failure
   - existing editor image provider contract smoke, if available
5. Build only if tests pass.

Return to the shared folder:
- completion report
- changed file list
- test summary
- installer + SHA256 if built
- final deploy recommendation: pass/block/unclear

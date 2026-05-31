# Windows Handoff - v1.0.11 Login + Editor Hardening Build

Date: 2026-05-20 KST
Scope: package the additional Windows fixes discovered during v1.0.10 smoke verification
Target: Windows unified installer only

## Why

The v1.0.10 hotfix already fixes and verifies the original error:

```text
input_content() got an unexpected keyword argument 'image_provider'
```

However, the later Windows verification reports discovered and locally fixed additional issues:

- Naver auto-login could falsely treat `nid.naver.com?...url=https://blog.naver.com` as a successful blog login because the query string contained `blog.naver.com`.
- Fresh login needed clipboard/native input before JS value injection for better Naver compatibility.
- SmartEditor entry needed direct `PostWriteForm.naver?blogId=<id>&Redirect=Write` fallback when `GoBlogWrite` or NID sync did not land in the editor.
- Body input could inherit stale SmartEditor inline formatting such as strikethrough, bold, italic, or underline.
- A local password re-save helper was used during verification, but any production UX must not expose secrets.

Important: the Windows report says these changes were applied in the Windows work folder, but no installer rebuild was performed after those changes. Therefore the current deployed v1.0.10 installer does not necessarily contain them.

## Guardrails

- Do not run paid AI calls.
- Do not call Gemini/OpenAI APIs.
- Do not perform real public publish or scheduled publish.
- Do not use real customer credentials in files, commands, reports, or Syncthing.
- Do not copy `.env`, API keys, cookies, Naver sessions, browser profiles, screenshots of auth/billing pages, or raw private logs into Syncthing.
- Build in a local Windows work folder, not inside Syncthing.
- Return a unified Windows installer only. Do not return split installers.

## Required Source Return

Return either a patch file or full sanitized copies of the changed source files.

Expected changed files from the Windows report:

- `browser/session_manager.py`
- `auth/naver_login.py`
- `posting/editor.py`
- optional dev helper: `update_naver_password_secure.py`
- any related tests/scripts used for verification

If any other file changed, list it explicitly and explain why.

## Required Build

1. Bump Windows local agent/app metadata to v1.0.11.
2. Preserve the v1.0.10 editor contract fix:

```python
input_content(driver, content_list, api_key, image_provider="gemini", fallback_api_key="")
```

3. Keep unified installer behavior only.
4. Build:

```text
aimax-bundle-windows.exe
```

5. Return:

- `aimax-bundle-windows.exe`
- `SHA256SUMS.txt`
- `WINDOWS_COMPLETION_20260520_v111_login_editor_hardening.md`
- source patch or sanitized changed files

## Required Verification

Run at minimum:

```powershell
python -m py_compile app.py auth/naver_login.py browser/session_manager.py posting/editor.py posting/publisher.py browser/stealth_driver.py scripts/verify_editor_image_provider_contract.py
python scripts/verify_editor_image_provider_contract.py
python verify_v110_no_paid_editor_smoke.py
```

Expected:

```text
EDITOR_IMAGE_PROVIDER_CONTRACT_OK
V110_NO_PAID_EDITOR_SMOKE_OK
```

If running live draft smoke, it must be draft-only and user-approved:

- no public publish
- no scheduled publish
- no paid AI provider calls unless explicitly approved
- user must complete any Naver login/password action directly

## Specific Regression Checks

Confirm in the completion report:

- `sync_pc_blog_login()` judges success by parsed host/domain, not by searching the full URL string.
- `nid.naver.com?...url=https://blog.naver.com` is not treated as successful blog login.
- `_fresh_login()` tries clipboard/native input before or instead of brittle JS-only value injection.
- login failure messages distinguish likely saved-password mismatch from CAPTCHA/security/manual confirmation.
- editor navigation has direct write URL fallback after NID/BlogHome detours.
- before body insertion, stale inline formatting states are reset or disabled.
- the original `image_provider` TypeError remains covered.

## AI Council

Use Claude/Gemini advisory review if available and authenticated. Keep the same safety rules:

- sanitized context only
- no credentials/secrets
- no API-key paid mode unless explicitly approved
- output is advisory; Windows developer makes final decision

Include AI Council status:

- `ai_council_ready`
- `ai_council_partial`
- `ai_council_needs_user_login`
- `ai_council_skipped`

## Completion Report Must Include

- work folder used
- exact files changed
- exact commands run
- exact command outputs
- whether any paid provider call occurred
- whether any real Naver action occurred
- installer size and SHA256
- whether the returned patch/source matches the installer build
- residual risks and blockers

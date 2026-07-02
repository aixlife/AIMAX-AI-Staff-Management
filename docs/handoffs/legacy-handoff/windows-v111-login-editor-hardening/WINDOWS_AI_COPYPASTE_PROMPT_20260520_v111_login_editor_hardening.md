Windows AIMAX AI developer, please package the additional Windows fixes discovered during the v1.0.10 smoke verification into a v1.0.11 unified Windows installer.

Read first:

`WINDOWS_HANDOFF_20260520_v111_login_editor_hardening.md`

Context:

The already deployed v1.0.10 installer fixes the original `input_content() got an unexpected keyword argument 'image_provider'` error.

Your later verification reports show additional local source changes for:

- Naver auto-login host-based success detection
- clipboard/native login input
- better password/security failure messages
- direct SmartEditor write URL fallback
- stale inline formatting reset before body input

But the report also says no installer rebuild was performed after those changes. Therefore package those changes into a v1.0.11 unified installer and return the source patch.

Rules:

- Do not run paid AI calls.
- Do not call Gemini/OpenAI APIs.
- Do not perform public publish or scheduled publish.
- Do not put credentials, cookies, API keys, `.env`, sessions, browser profiles, or auth/billing screenshots into Syncthing.
- Build in a local Windows work folder, not inside Syncthing.
- Return unified installer only.

Required returns:

- `WINDOWS_COMPLETION_20260520_v111_login_editor_hardening.md`
- `aimax-bundle-windows.exe`
- `SHA256SUMS.txt`
- a source patch or sanitized changed file copies

Minimum commands:

```powershell
python -m py_compile app.py auth/naver_login.py browser/session_manager.py posting/editor.py posting/publisher.py browser/stealth_driver.py scripts/verify_editor_image_provider_contract.py
python scripts/verify_editor_image_provider_contract.py
python verify_v110_no_paid_editor_smoke.py
```

The completion report must explicitly confirm:

- `sync_pc_blog_login()` does not treat `nid.naver.com?...url=https://blog.naver.com` as success.
- fresh login uses clipboard/native input before or instead of JS-only value injection.
- login failure messages distinguish saved-password mismatch vs security/manual confirmation.
- editor navigation has direct write URL fallback.
- stale SmartEditor inline formatting is reset before body insertion.
- original `image_provider` TypeError remains fixed.
- returned patch/source is the same source used to build the installer.

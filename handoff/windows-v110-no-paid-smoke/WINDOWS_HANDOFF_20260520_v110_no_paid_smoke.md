# Windows Handoff - v1.0.10 No-Paid Smoke Verification

Date: 2026-05-20 KST
Scope: Verification only
Target artifact: Windows unified installer v1.0.10

## Why

Read the previous sanitized failure context first:

`PREVIOUS_ERROR_CONTEXT_20260520.md`

Claude Code and Gemini both agreed that the v1.0.10 hotfix is likely sufficient for the reported `input_content(... image_provider=...)` TypeError and update gating.

They also flagged one remaining confidence gap: the fix has not been exercised through a no-paid local-agent smoke path that calls the editor input function with generated-content-like data.

Optional advisory workflow: if Claude Code and/or Gemini CLI are already available on the Windows machine, use `WINDOWS_AI_COUNCIL_SETUP_20260520.md` to run a sanitized independent review before finalizing. If they are not available, do not block this smoke verification just to install them.

## Guardrails

- Do not run paid AI calls.
- Do not call Gemini/OpenAI APIs.
- Do not publish, save, or draft a real Naver post.
- Do not use real customer credentials.
- Do not build inside the Syncthing shared folder.
- Work in the existing local Windows work folder used for v1.0.10, or copy source to a local Windows work folder first.
- Keep secrets, cookies, `.env`, API keys, Naver sessions, and browser profiles out of Syncthing.

## Required Checks

1. Confirm the current Windows work folder is v1.0.10.
2. Confirm the returned installer hash still matches:
   - `605225c5986fe98e950faa186d66769251d313ecfb2d77b8c08fc27f130af59c`
3. Run:

```powershell
python -m py_compile app.py local_agent/runtime.py posting/editor.py browser/stealth_driver.py scripts/verify_editor_image_provider_contract.py
python scripts/verify_editor_image_provider_contract.py
```

Expected:

```text
EDITOR_IMAGE_PROVIDER_CONTRACT_OK
```

4. Add or run a temporary no-paid smoke script in the local Windows work folder that:
   - imports `posting.editor`
   - monkeypatches `_dismiss_editor_popup`, `_input_text_block`, `_input_quotation`, `_input_image`, `wait_short`, and `ActionChains` so no real browser, upload, AI call, or Naver interaction occurs
   - calls:

```python
editor.input_content(
    fake_driver,
    [
        ("text", [("normal", "mock paragraph")]),
        ("quote", "mock quote"),
        ("image", "mock image prompt"),
    ],
    api_key="dummy",
    image_provider="gemini",
    fallback_api_key="dummy-fallback",
)
```

Expected:

- No `TypeError`
- `_input_image` receives `image_provider="gemini"` and `fallback_api_key="dummy-fallback"`
- Returned stats include:
  - `image_attempted == 1`
  - `image_generated == 1`
  - `image_inserted == 1`
  - `image_providers.gemini == 1`

5. If practical without paid calls, repeat the smoke with `image_provider="openai"` and verify `image_providers.openai == 1`.

## Return Files

Return these to this Syncthing folder:

- `WINDOWS_COMPLETION_20260520_v110_no_paid_smoke.md`
- Any temporary smoke script used, named `verify_v110_no_paid_editor_smoke.py`
- If the installer is rebuilt, return the new `aimax-bundle-windows.exe` and `SHA256SUMS.txt`; otherwise explicitly state that no rebuild was performed.

## Completion Report Must Include

- Work folder used
- Whether any rebuild was performed
- Exact commands run
- Exact outputs for the contract verifier and no-paid smoke script
- Confirmation that the smoke directly covers the previous `image_provider` TypeError context in `PREVIOUS_ERROR_CONTEXT_20260520.md`
- Confirmation that no paid AI calls and no real Naver actions were performed
- Any blockers or residual risks

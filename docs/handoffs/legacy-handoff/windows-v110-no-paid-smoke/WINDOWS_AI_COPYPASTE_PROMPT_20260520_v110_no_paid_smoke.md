Windows AIMAX AI developer, please perform a verification-only pass for the v1.0.10 hotfix.

Read first:

`PREVIOUS_ERROR_CONTEXT_20260520.md`

`WINDOWS_HANDOFF_20260520_v110_no_paid_smoke.md`

Optional, if Claude Code or Gemini CLI are already available or can be installed without exposing secrets:

`WINDOWS_AI_COUNCIL_SETUP_20260520.md`

Authentication/subscription rule:

- If Claude/Gemini requires login, subscription confirmation, billing/project selection, browser approval, or API key setup, stop and ask Minsoo to complete it directly on the Windows machine.
- Do not receive, paste, save, or transmit raw credentials, API keys, tokens, cookies, recovery codes, passwords, auth screenshots, or billing pages.
- Do not switch to API-key paid mode unless Minsoo explicitly approves it.
- In the completion report, include one status: `ai_council_ready`, `ai_council_partial`, `ai_council_needs_user_login`, or `ai_council_skipped`.

Rules:

- Do not run paid AI calls.
- Do not call Gemini/OpenAI APIs.
- Do not publish, save, or draft a real Naver post.
- Do not use real customer credentials.
- Do not build inside the Syncthing shared folder.
- Work in the existing local Windows v1.0.10 work folder, or copy source out to a local Windows work folder first.
- Keep secrets, cookies, `.env`, API keys, Naver sessions, and browser profiles out of Syncthing.

Goal:

Confirm the v1.0.10 fix is not just syntactically correct but can call the editor content input path with `image_provider` and `fallback_api_key` without the previous reported TypeError:

```text
input_content() got an unexpected keyword argument 'image_provider'
```

Required commands:

```powershell
python -m py_compile app.py local_agent/runtime.py posting/editor.py browser/stealth_driver.py scripts/verify_editor_image_provider_contract.py
python scripts/verify_editor_image_provider_contract.py
```

Expected:

```text
EDITOR_IMAGE_PROVIDER_CONTRACT_OK
```

Then create or run a temporary no-paid smoke script in the local work folder. The script should import `posting.editor`, monkeypatch browser/AI functions to no-op fakes, and call:

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

Pass criteria:

- No `TypeError`
- `_input_image` receives `image_provider="gemini"` and `fallback_api_key="dummy-fallback"`
- result has `image_attempted == 1`, `image_generated == 1`, `image_inserted == 1`, and `image_providers.gemini == 1`
- If practical, repeat with `image_provider="openai"` and verify `image_providers.openai == 1`

Return to the Syncthing folder:

- `WINDOWS_COMPLETION_20260520_v110_no_paid_smoke.md`
- `verify_v110_no_paid_editor_smoke.py`
- If no rebuild was performed, explicitly say no installer rebuild was performed.
- If a rebuild was performed, return the new `aimax-bundle-windows.exe` and `SHA256SUMS.txt`.

The completion report must include exact commands, exact outputs, work folder used, and confirmation that no paid AI calls and no real Naver actions were performed.
Also explicitly say whether the smoke covers the previous error context in `PREVIOUS_ERROR_CONTEXT_20260520.md`.

# Windows Handoff: R3-G Empty Image Prompt Guard

Date: 2026-05-26 KST

## Read First

Before starting, read:

```text
WINDOWS_CONTINUOUS_TIKITAKA_PROTOCOL.md
WINDOWS_HANDOFF_20260526_r3g_empty_image_prompt_guard.md
```

Work in a local Windows work folder. Do not build inside Syncthing. Do not put secrets, browser profiles, `.env`, cookies, or customer data into Syncthing.

## Goal

Implement and verify the same R3-G fix on Windows:

- Empty image prompts from generated markdown must not break Yeori image insertion.
- If a markdown image line is empty or placeholder-like, repair it into a safe fallback prompt based on title/keyword.
- Valid image prompts must remain unchanged.
- No paid AI call is allowed for this Windows readiness task.
- No Apify call.
- No Naver publish/schedule.
- No customer credentials.

Target Windows release version:

```text
v1.0.22
```

## Source Package

Mac-side source package:

```text
r3g_changed_files_mac_source.zip
```

Use it as a reference patch/source. Apply the same logic to the Windows working source.

Expected changed files or equivalent Windows paths:

```text
app.py
split_version/app.py
posting/editor.py
aimax_compliance.py
split_version/aimax_compliance.py
```

## Required Logic

Add helper behavior equivalent to:

```text
_is_empty_image_prompt(prompt)
_fallback_image_prompt(title, source, index)
_repair_empty_image_prompts(content_list, title="", source="")
```

Call the repair layer after `parse_markdown(...)` and before image block limiting or image generation.

Also add final defensive behavior in `posting/editor.py`:

```text
if not prompt:
    log warning
    return {"generated": False, "inserted": False}
```

## Verification Criteria

Run Windows Codex verification directly in the Windows environment:

1. Syntax check:
   ```text
   python -m py_compile app.py split_version/app.py posting/editor.py aimax_compliance.py split_version/aimax_compliance.py
   ```

2. No-paid unit/smoke:
   - Build a markdown sample containing `[이미지]`.
   - Confirm empty prompt is repaired to a non-empty fallback prompt.
   - Confirm a valid prompt is unchanged.
   - Confirm no paid AI/OpenAI/Gemini/Apify/Naver mutation is invoked.

3. Build Windows runner:
   - Build installed runner package as `v1.0.22`.
   - Return `aimax-bundle-windows.exe`.
   - Return SHA256.

4. Installed diagnostics:
   - Install or run frozen diagnostics from the produced package.
   - Confirm:
     ```text
     version == v1.0.22
     frozen runtime == true
     ai_text_import_smoke.ok == true
     browser_version_detection.ok == true
     ```

## Return Files

Return these files to this same Syncthing folder:

```text
WINDOWS_RESULT_20260526_r3g_empty_image_prompt_guard.md
aimax_r3g_v122_empty_image_prompt_guard_diag.json
aimax-bundle-windows.exe
NEXT_TRIGGER_20260526_r3g_empty_image_prompt_guard.json
```

## NEXT_TRIGGER Requirements

If pass:

```json
{
  "verdict": "pass",
  "phase": "r3g_empty_image_prompt_guard",
  "next_recommended_action": "mac_verify_windows_r3g_then_prepare_rollout",
  "requires_mac_action": true,
  "requires_windows_action": false,
  "safe_to_continue_without_user": true,
  "requires_user_approval": false,
  "versions": {
    "windows": "v1.0.22"
  },
  "artifacts": [
    "WINDOWS_RESULT_20260526_r3g_empty_image_prompt_guard.md",
    "aimax_r3g_v122_empty_image_prompt_guard_diag.json",
    "aimax-bundle-windows.exe"
  ],
  "forbidden_actions_confirmed": {
    "paid_ai": true,
    "apify": true,
    "naver_publish_or_schedule": true,
    "customer_credentials": true,
    "shared_secrets": true
  },
  "notes": "Windows R3-G no-paid verification and package build passed."
}
```

If blocked:

```json
{
  "verdict": "blocked",
  "phase": "r3g_empty_image_prompt_guard",
  "blocker": "Narrow blocker here",
  "requires_mac_action": true,
  "requires_user_approval": false,
  "safe_to_continue_without_user": false,
  "notes": "What Mac-side should inspect next."
}
```

## Stop Conditions

Stop and report a blocker if:

- the produced package is not `v1.0.22`,
- no-paid smoke cannot prove empty prompt repair,
- diagnostics cannot confirm frozen runtime,
- the task would require paid AI, Apify, Naver publish/schedule, customer credentials, or secrets in Syncthing.

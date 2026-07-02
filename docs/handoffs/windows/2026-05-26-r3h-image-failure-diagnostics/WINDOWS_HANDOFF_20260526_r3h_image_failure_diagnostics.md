# Windows Handoff: R3-H Image Failure Diagnostics

Date: 2026-05-26 KST

## Read First

Before starting, read:

```text
WINDOWS_CONTINUOUS_TIKITAKA_PROTOCOL.md
WINDOWS_HANDOFF_20260526_r3h_image_failure_diagnostics.md
```

Work in a local Windows work folder. Do not build inside Syncthing. Do not put secrets, browser profiles, `.env`, cookies, raw private logs, or customer data into Syncthing.

## Goal

Implement and verify R3-H on Windows:

- Keep the R3-G empty image prompt guard.
- Add structured, sanitized diagnostics for Yeori image failures.
- Distinguish generation, upload, insert exception, prompt-empty, and final completion failures.
- Keep paid AI, Apify, and Naver mutation disabled for this readiness task.

Target Windows release version:

```text
v1.0.23
```

## Source Package

Mac-side source package:

```text
r3h_changed_files_mac_source.zip
```

Use it as a reference patch/source. Apply equivalent logic to the local Windows working source.

Expected changed files or equivalent Windows paths:

```text
app.py
split_version/app.py
posting/editor.py
aimax_compliance.py
split_version/aimax_compliance.py
scripts/smoke_yeri_image_failure_diagnostics.py
```

The ZIP may include source paths exactly as above. Preserve Windows-specific build/runtime differences where needed.

## Required Behavior

`posting/editor.py` should return structured image result data from `_input_image(...)`:

```json
{
  "generated": false,
  "inserted": false,
  "provider": "gemini",
  "stage": "image_generation",
  "error_code": "image_generation_failed",
  "method": "",
  "message": "sanitized short message"
}
```

Required stage values:

```text
image_prompt_empty
image_generation
image_upload
image_insert_exception
image_inserted
image_completion
```

`input_content(...)` must aggregate:

```text
image_attempted
image_generated
image_inserted
image_providers
image_failures
image_results
```

`app.py` and `split_version/app.py` must:

- preserve `images.failures` in the returned write result,
- set failed stage to the narrow image stage when image insertion count is below requested count,
- include per-post image failure diagnostics in `failed_posts`,
- never include secrets, raw API keys, cookies, signed URLs, or customer credentials in diagnostics.

## Verification Criteria

Run Windows Codex verification directly in the Windows environment:

1. Syntax check:

   ```text
   python -m py_compile aimax_compliance.py split_version\aimax_compliance.py app.py split_version\app.py posting\editor.py scripts\smoke_yeri_image_failure_diagnostics.py
   ```

2. No-paid smoke:

   ```text
   python scripts\smoke_yeri_image_failure_diagnostics.py
   ```

   Expected:

   ```text
   R3H_YERI_IMAGE_FAILURE_DIAGNOSTICS_OK
   ```

3. Existing editor contract smoke:

   ```text
   python scripts\verify_editor_image_provider_contract.py
   ```

   Expected:

   ```text
   EDITOR_IMAGE_PROVIDER_CONTRACT_OK
   ```

4. Build Windows runner:

   - Build installed runner package as `v1.0.23`.
   - Return `aimax-bundle-windows.exe`.
   - Return SHA256.

5. Installed or frozen diagnostics:

   Confirm:

   ```text
   version == v1.0.23
   frozen runtime == true
   ai_text_import_smoke.ok == true
   browser_version_detection.ok == true
   ```

## Return Files

Return these files to this same Syncthing folder:

```text
WINDOWS_RESULT_20260526_r3h_image_failure_diagnostics.md
aimax_r3h_v123_image_failure_diagnostics_diag.json
aimax-bundle-windows.exe
NEXT_TRIGGER_20260526_r3h_image_failure_diagnostics.json
```

## NEXT_TRIGGER Requirements

If pass:

```json
{
  "verdict": "pass",
  "phase": "r3h_image_failure_diagnostics",
  "next_recommended_action": "mac_verify_windows_r3h_then_prepare_rollout_or_r3i",
  "requires_mac_action": true,
  "requires_windows_action": false,
  "safe_to_continue_without_user": true,
  "requires_user_approval": false,
  "versions": {
    "windows": "v1.0.23"
  },
  "artifacts": [
    "WINDOWS_RESULT_20260526_r3h_image_failure_diagnostics.md",
    "aimax_r3h_v123_image_failure_diagnostics_diag.json",
    "aimax-bundle-windows.exe"
  ],
  "forbidden_actions_confirmed": {
    "paid_ai": true,
    "apify": true,
    "naver_publish_or_schedule": true,
    "customer_credentials": true,
    "shared_secrets": true
  },
  "notes": "Windows R3-H no-paid verification and package build passed."
}
```

If blocked:

```json
{
  "verdict": "blocked",
  "phase": "r3h_image_failure_diagnostics",
  "blocker": "Narrow blocker here",
  "requires_mac_action": true,
  "requires_user_approval": false,
  "safe_to_continue_without_user": false,
  "notes": "What Mac-side should inspect next."
}
```

## Stop Conditions

Stop and report a blocker if:

- the produced package is not `v1.0.23`,
- no-paid smoke cannot prove image failure stages,
- diagnostics cannot confirm frozen runtime,
- the task would require paid AI, Apify, Naver publish/schedule/edit/save, customer credentials, or secrets in Syncthing.

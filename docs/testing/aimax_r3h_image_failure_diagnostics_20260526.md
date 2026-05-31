# AIMAX R3-H Image Failure Diagnostics

Date: 2026-05-26 KST

## Purpose

R3-G prevented empty image prompts from reaching paid image providers. R3-H separates the remaining Yeori image failures into clear, sanitized stages so support can tell whether a job failed during image generation, Naver upload, or final insertion.

## Changed Files

```text
app.py
split_version/app.py
posting/editor.py
oracle/aimax-reports-api/server.js
oracle/aimax-reports-api/static/app.html
aimax_compliance.py
split_version/aimax_compliance.py
scripts/smoke_yeri_image_failure_diagnostics.py
```

## Behavior

- `posting/editor.py` now returns structured image result fields:
  - `stage`
  - `error_code`
  - `provider`
  - `method`
  - `message`
- `input_content(...)` aggregates `image_failures` and `image_results`.
- Yeori write results include image failure diagnostics under `result.images.failures`.
- Failed post records include the same sanitized image failure list.
- Server-side result sanitization preserves image failure diagnostics without secrets.
- Web failure stage labels now distinguish:
  - `image_generation`
  - `image_upload`
  - `image_insert_exception`
  - `image_prompt_empty`
  - `image_completion`

## No-Paid Verification

```text
venv/bin/python -m py_compile aimax_compliance.py split_version/aimax_compliance.py app.py split_version/app.py posting/editor.py scripts/smoke_yeri_image_failure_diagnostics.py
pass

venv/bin/python scripts/smoke_yeri_image_failure_diagnostics.py
R3H_YERI_IMAGE_FAILURE_DIAGNOSTICS_OK

venv/bin/python scripts/verify_editor_image_provider_contract.py
EDITOR_IMAGE_PROVIDER_CONTRACT_OK

node --check oracle/aimax-reports-api/server.js
pass
```

The smoke verified:

- empty prompt skips provider calls and reports `image_prompt_empty`,
- provider returning no file reports `image_generation`,
- file input plus clipboard upload failure reports `image_upload`,
- clipboard success reports `image_inserted`,
- `input_content(...)` aggregates attempted/generated/inserted counts and image failures.

## Safety

- No paid AI call.
- No Apify call.
- No Naver publish/schedule/edit/save mutation.
- No customer credentials.
- No live Oracle deployment yet for R3-H.

## Version Plan

```text
Mac source candidate: v1.0.14
Windows target candidate: v1.0.23
```

## Next

Send the local-runner portion to Windows Codex for Windows `v1.0.23` implementation, no-paid verification, build, and diagnostics.

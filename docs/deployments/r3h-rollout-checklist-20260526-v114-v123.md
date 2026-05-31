# AIMAX R3-H Rollout Checklist

Date: 2026-05-26 KST

## Status

R3-H Image Failure Diagnostics is ready for rollout, but not deployed live yet.

## Versions

```text
macOS: v1.0.14
Windows: v1.0.23
```

## Fix

Yeori now preserves structured image diagnostics so support can distinguish:

```text
image_prompt_empty
image_generation
image_upload
image_insert_exception
image_inserted
image_completion
```

The result payload preserves sanitized image aggregates:

```text
image_attempted
image_generated
image_inserted
image_providers
image_failures
image_results
```

## Mac Evidence

From:

```text
docs/deployments/macos-build-20260526-v114-r3h-image-failure-diagnostics.md
```

Evidence:

```text
version: v1.0.14
frozen runtime: true
ai_text_import_smoke.ok: true
codesign --verify --deep --strict: pass
hdiutil verify: pass
sha256: 6a99813dcb98ed52b38edf51a4bea01786dcbceb0d991d941c73da5beef6c0e6
```

## Windows Evidence

Returned from:

```text
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-26-r3h-image-failure-diagnostics
```

Evidence:

```text
WINDOWS_RESULT_20260526_r3h_image_failure_diagnostics.md
aimax_r3h_v123_image_failure_diagnostics_diag.json
NEXT_TRIGGER_20260526_r3h_image_failure_diagnostics.json
```

Pass criteria:

```text
version: v1.0.23
syntax check: pass
no-paid image failure diagnostics smoke: pass
editor image provider contract smoke: pass
frozen runtime: true
ai_text_import_smoke.ok: true
browser_version_detection.ok: true
installer sha256: 31ddbb245569b5cb7a8bed0bd656a0d82b927f26c8ca16f79b641496c3cc3962
```

## Staged Local Installers

```text
dist/upload_installers/aimax-bundle-macos.dmg
sha256: 6a99813dcb98ed52b38edf51a4bea01786dcbceb0d991d941c73da5beef6c0e6

dist/upload_installers/aimax-bundle-windows.exe
sha256: 31ddbb245569b5cb7a8bed0bd656a0d82b927f26c8ca16f79b641496c3cc3962
```

Previous staged installers were archived:

```text
dist/upload_installers/archive-macos-20260526-pre-v114-r3h-image-failure-diagnostics/aimax-bundle-macos.dmg
dist/upload_installers/archive-windows-20260526-pre-v123-r3h-image-failure-diagnostics/aimax-bundle-windows.exe
```

## Safety Confirmed

```text
No paid AI call for R3-H readiness.
No Apify call.
No Naver publish/schedule/edit/save mutation.
No customer credentials.
No secrets, cookies, .env, browser profiles, signed URLs, or raw private logs shared.
```

## Live Rollout Steps

Requires explicit user approval before execution.

1. Back up current Oracle installer files and `.env`.
2. Upload staged Mac and Windows installers.
3. Update Oracle version API:

```text
AIMAX_MACOS_LATEST_AGENT_VERSION=v1.0.14
AIMAX_MACOS_MIN_AGENT_VERSION=v1.0.14
AIMAX_WINDOWS_LATEST_AGENT_VERSION=v1.0.23
AIMAX_WINDOWS_MIN_AGENT_VERSION=v1.0.23
```

4. Restart `systemctl --user restart aimax-reports-api.service`.
5. Verify public API:

```text
/api/version?platform=macos&current=v1.0.13 -> update_required true
/api/version?platform=macos&current=v1.0.14 -> update_required false
/api/version?platform=windows&current=v1.0.22 -> update_required true
/api/version?platform=windows&current=v1.0.23 -> update_required false
```

6. Verify remote installer hashes match the staged local hashes.

## Next Gate

R3-H is staged locally and ready for live rollout approval.

Do not start R3-I until R3-H rollout is either deployed or intentionally deferred.

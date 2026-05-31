# AIMAX R3-G Rollout Checklist

Date: 2026-05-26 KST

## Status

R3-G Empty Image Prompt Guard is ready for rollout, but not deployed live yet.

## Versions

```text
macOS: v1.0.13
Windows: v1.0.22
```

## Fix

Yeori now repairs empty or placeholder image prompts before image generation.

Examples guarded:

```text
[이미지]
[이미지] 프롬프트:
[이미지] 이미지
```

If a prompt is empty, the runner derives a safe fallback from the title or keyword. Valid image prompts are preserved.

## Mac Evidence

```text
version: v1.0.13
diagnostics: /private/tmp/aimax_v113_r3g_diag.json
frozen runtime: true
ai_text_import_smoke.ok: true
codesign --verify --deep --strict: pass
hdiutil verify dist/AIMAX-macos.dmg: pass
sha256: 333a8fce6ae2662faea919c0ec0fb3a391e67caec99fcb43b6ee09fbb7c65d71
```

## Windows Evidence

Returned from:

```text
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-26-r3g-empty-image-prompt-guard
```

Evidence:

```text
WINDOWS_RESULT_20260526_r3g_empty_image_prompt_guard.md
aimax_r3g_v122_empty_image_prompt_guard_diag.json
NEXT_TRIGGER_20260526_r3g_empty_image_prompt_guard.json
```

Pass criteria:

```text
version: v1.0.22
syntax check: pass
no-paid empty prompt repair smoke: pass
valid prompt unchanged: pass
editor empty prompt skip without provider call: pass
frozen runtime: true
ai_text_import_smoke.ok: true
browser_version_detection.ok: true
installer sha256: 47588dd8d14c0d8a2c21b7ee51c260b50321342de0f845d9913e57bd021ceb5a
```

## Staged Local Installers

```text
dist/upload_installers/aimax-bundle-macos.dmg
sha256: 333a8fce6ae2662faea919c0ec0fb3a391e67caec99fcb43b6ee09fbb7c65d71

dist/upload_installers/aimax-bundle-windows.exe
sha256: 47588dd8d14c0d8a2c21b7ee51c260b50321342de0f845d9913e57bd021ceb5a
```

Previous staged installers were archived:

```text
dist/upload_installers/archive-macos-20260526-pre-v113-r3g-rollout/aimax-bundle-macos.dmg
dist/upload_installers/archive-windows-20260526-pre-v122-r3g-rollout/aimax-bundle-windows.exe
```

## Safety Confirmed

```text
No paid AI call for R3-G readiness.
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
AIMAX_MACOS_LATEST_AGENT_VERSION=v1.0.13
AIMAX_MACOS_MIN_AGENT_VERSION=v1.0.13
AIMAX_WINDOWS_LATEST_AGENT_VERSION=v1.0.22
AIMAX_WINDOWS_MIN_AGENT_VERSION=v1.0.22
```

4. Restart `systemctl --user restart aimax-reports-api.service`.
5. Verify public API:

```text
/api/version?platform=macos&current=v1.0.12 -> update_required true
/api/version?platform=macos&current=v1.0.13 -> update_required false
/api/version?platform=windows&current=v1.0.21 -> update_required true
/api/version?platform=windows&current=v1.0.22 -> update_required false
```

6. Verify remote installer hashes match the staged local hashes.

## Next Gate

Stop here and ask before live R3-G deployment.

Do not start R3-H until the user explicitly approves the next phase.

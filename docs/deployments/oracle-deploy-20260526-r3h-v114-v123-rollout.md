# Oracle Deploy 20260526 R3-H v1.0.14/v1.0.23 Rollout

## Scope

- R3-H live rollout completed.
- Mac unified runner: `v1.0.14`
- Windows unified runner: `v1.0.23`
- Server code was not changed.
- Installer files and version API environment values were updated.

## Fix

R3-H preserves structured Yeori image failure diagnostics:

```text
image_prompt_empty
image_generation
image_upload
image_insert_exception
image_inserted
image_completion
```

This makes support reports clearer when a job requests images but generation, upload, or insertion fails.

## Pre-Deploy Error Report Check

Checked latest reports under:

```text
/home/ubuntu/aimax-reports/data/reports/2026-05-26
```

Recent user blockers:

```text
AIMAX-RPT-20260526065632-57438e24
- Platform: Windows
- Web/app version: v1.0.15
- Issue: user says latest was installed, but web still sees old v1.0.15 and runner does not open.
- R3-H impact: not directly fixed by R3-H. Promoted to R3-I runner liveness/update recognition hotfix.

AIMAX-RPT-20260526043826-00f312ea
- Platform: macOS
- App version: v1.0.13
- Issue: Naver password save/local settings hangs; hang report points at UI-thread blocking wait.
- R3-H impact: not directly fixed by R3-H. Promoted to R3-I Keychain/write timeout hotfix.

AIMAX-RPT-20260525230206-cd8e0825
- Platform: Windows
- App version: v1.0.21
- Issue: Yeori image requested but inserted 0.
- R3-H impact: directly relevant; R3-H adds structured image diagnostics after R3-G empty prompt guard.
```

## Installer SHA256

```text
6a99813dcb98ed52b38edf51a4bea01786dcbceb0d991d941c73da5beef6c0e6  aimax-bundle-macos.dmg
31ddbb245569b5cb7a8bed0bd656a0d82b927f26c8ca16f79b641496c3cc3962  aimax-bundle-windows.exe
```

## Remote Changes

Backup directory:

```text
/home/ubuntu/aimax-backups/20260526-r3h-v114-v123-rollout
```

Updated installer files:

```text
/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg
/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe
```

Updated `/home/ubuntu/aimax-reports-api/.env`:

```text
AIMAX_MACOS_LATEST_AGENT_VERSION=v1.0.14
AIMAX_MACOS_MIN_AGENT_VERSION=v1.0.14
AIMAX_WINDOWS_LATEST_AGENT_VERSION=v1.0.23
AIMAX_WINDOWS_MIN_AGENT_VERSION=v1.0.23
AIMAX_MACOS_AGENT_RELEASE_NOTES=Mac 예리 이미지 실패 진단 업데이트입니다. 이미지 생성/업로드/삽입 실패 단계를 더 정확히 보고합니다. 설치 후 실행기를 다시 연결해주세요.
AIMAX_WINDOWS_AGENT_RELEASE_NOTES=Windows 예리 이미지 실패 진단 업데이트입니다. 이미지 생성/업로드/삽입 실패 단계를 더 정확히 보고합니다. 설치 후 실행기를 다시 연결해주세요.
```

Service restart:

```text
systemctl --user restart aimax-reports-api.service
systemctl --user is-active aimax-reports-api.service: active
```

## Verification

Public version API:

```text
GET /api/version?platform=macos&current=v1.0.13
latest_version: v1.0.14
min_version: v1.0.14
update_required: true

GET /api/version?platform=macos&current=v1.0.14
latest_version: v1.0.14
min_version: v1.0.14
update_required: false

GET /api/version?platform=windows&current=v1.0.22
latest_version: v1.0.23
min_version: v1.0.23
update_required: true

GET /api/version?platform=windows&current=v1.0.23
latest_version: v1.0.23
min_version: v1.0.23
update_required: false
```

Health:

```text
GET /api/reports/health
ok: true
storage.ok: true
recent_issues: []
```

Remote installer hashes match local staged hashes.

## Safety

- No paid AI call was made during rollout.
- No Apify call was made.
- No Naver publish, schedule, edit, or draft mutation was made.
- No customer credential was used.
- Report contents were reviewed in sanitized summary form.

## Next Gate

R3-H is live.

R3-I is started to address the remaining direct blockers:

```text
macOS: settings/password-save hang caused by UI-thread secret-store writes
Windows: stale old runner/update recognition loop after latest install
```

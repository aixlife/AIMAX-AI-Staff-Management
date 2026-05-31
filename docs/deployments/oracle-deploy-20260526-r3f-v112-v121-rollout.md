# Oracle Deploy 20260526 R3-F v1.0.12/v1.0.21 Rollout

## Scope

- R3-F live rollout completed.
- Mac unified runner: `v1.0.12`
- Windows unified runner: `v1.0.21`
- Server code was not changed in this rollout.
- Only installer files and version API environment values were updated.

## Local Build Evidence

- Mac app bundle: `dist/AIMAX.app`
- Mac DMG: `dist/AIMAX-macos.dmg`
- Mac bundle version: `1.0.12`
- Mac diagnostics probe: `/private/tmp/aimax_v112_diag.json`
- Installed Mac diagnostics probe: `/private/tmp/aimax_installed_v112_diag.json`
- Installed Mac app: `/Applications/AIMAX.app`

Validation:

```text
dist/AIMAX.app codesign --verify --deep --strict: pass
dist/AIMAX-macos.dmg hdiutil verify: pass
/Applications/AIMAX.app bundle version: 1.0.12
/Applications/AIMAX.app diagnostics version: v1.0.12
/Applications/AIMAX.app frozen runtime: true
ai_text_import_smoke.ok: true
```

## Installer SHA256

```text
3fd8910fdb567da6c2730e410634788ee083ae943a031a1cfe3c74a9efd6ae2d  aimax-bundle-macos.dmg
9886c05275355a9548ca7dca36d2804c096a734bec7336dc05bfb3dc4084cb2f  aimax-bundle-windows.exe
```

Windows installer source:

```text
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-26-r3f-release-rollout/aimax-bundle-windows.exe
```

Windows release-ready evidence:

```text
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-26-r3f-release-rollout/WINDOWS_RESULT_20260526_r3f_release_rollout.md
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-26-r3f-release-rollout/aimax_r3f_v121_release_ready_diag.json
```

## Remote Changes

Backup directory:

```text
/home/ubuntu/aimax-backups/20260526-r3f-v112-v121-rollout
```

Updated installer files:

```text
/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg
/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe
```

Updated `/home/ubuntu/aimax-reports-api/.env` values:

```text
AIMAX_MACOS_LATEST_AGENT_VERSION=v1.0.12
AIMAX_MACOS_MIN_AGENT_VERSION=v1.0.12
AIMAX_WINDOWS_LATEST_AGENT_VERSION=v1.0.21
AIMAX_WINDOWS_MIN_AGENT_VERSION=v1.0.21
AIMAX_MACOS_AGENT_RELEASE_NOTES=Mac 예리 글쓰기 NID 로그인 루프 및 이미지 삽입 안정화 업데이트입니다. 설치 후 실행기를 다시 연결해주세요.
AIMAX_WINDOWS_AGENT_RELEASE_NOTES=Windows 예리 글쓰기 E2E 통과 버전입니다. 실행기 재연결과 이미지 삽입 안정화가 포함되었습니다. 설치 후 실행기를 다시 연결해주세요.
```

Service restart:

```text
systemctl --user restart aimax-reports-api.service
systemctl --user is-active aimax-reports-api.service: active
Main PID after restart: 3385058
```

## Public Version API Verification

```text
GET /api/version?platform=macos&current=v1.0.11
latest_version: v1.0.12
min_version: v1.0.12
update_required: true

GET /api/version?platform=macos&current=v1.0.12
latest_version: v1.0.12
min_version: v1.0.12
update_required: false

GET /api/version?platform=windows&current=v1.0.20
latest_version: v1.0.21
min_version: v1.0.21
update_required: true

GET /api/version?platform=windows&current=v1.0.21
latest_version: v1.0.21
min_version: v1.0.21
update_required: false
```

## Safety Notes

- No paid AI call was made during rollout readiness/deployment.
- No Apify call was made.
- No Naver publish or schedule action was made.
- No customer credential was used.
- R3-G remains the next approved phase.

# Oracle Deploy 20260526 R3-G v1.0.13/v1.0.22 Rollout

## Scope

- R3-G live rollout completed.
- Mac unified runner: `v1.0.13`
- Windows unified runner: `v1.0.22`
- Server code was not changed.
- Installer files and version API environment values were updated.

## Pre-Deploy Error Report Check

Checked latest reports under:

```text
/home/ubuntu/aimax-reports/data/reports/2026-05-25
```

Recent reports:

```text
AIMAX-RPT-20260525043813-ca0c41e0
- Platform: Windows
- App/Web version: v1.0.17
- User-facing issue: update loop / app cannot open
- R3-G impact: latest Windows runner is now v1.0.22; update-required logic points users beyond this old version.

AIMAX-RPT-20260525125020-96b6fc9a
- Platform: macOS
- App/Web version: v1.0.9
- User-facing issue: local settings open request timed out / retried
- R3-G impact: latest Mac runner is now v1.0.13; prior reconnect/settings fixes are included in the newer line.

AIMAX-RPT-20260525230206-cd8e0825
- Platform: Windows
- App/Web version: v1.0.21
- User-facing issue: Yeori stopped during Smart Editor input; requested 1 image but inserted 0
- R3-G impact: directly relevant. Empty/placeholder image prompts are now repaired before image generation in Windows v1.0.22 and Mac v1.0.13.
```

No report blocked the R3-G rollout.

## Local Build Evidence

Mac app bundle:

```text
dist/AIMAX.app
```

Mac installed app:

```text
/Applications/AIMAX.app
```

Installed Mac verification:

```text
bundle version: 1.0.13
diagnostics: /private/tmp/aimax_installed_v113_r3g_diag.json
diagnostics version: v1.0.13
frozen runtime: true
codesign --verify --deep --strict: pass
```

## Installer SHA256

```text
333a8fce6ae2662faea919c0ec0fb3a391e67caec99fcb43b6ee09fbb7c65d71  aimax-bundle-macos.dmg
47588dd8d14c0d8a2c21b7ee51c260b50321342de0f845d9913e57bd021ceb5a  aimax-bundle-windows.exe
```

## Remote Changes

Backup directory:

```text
/home/ubuntu/aimax-backups/20260526-r3g-v113-v122-rollout
```

Updated installer files:

```text
/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg
/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe
```

Updated `/home/ubuntu/aimax-reports-api/.env`:

```text
AIMAX_MACOS_LATEST_AGENT_VERSION=v1.0.13
AIMAX_MACOS_MIN_AGENT_VERSION=v1.0.13
AIMAX_WINDOWS_LATEST_AGENT_VERSION=v1.0.22
AIMAX_WINDOWS_MIN_AGENT_VERSION=v1.0.22
AIMAX_MACOS_AGENT_RELEASE_NOTES=Mac 예리 이미지 프롬프트 보정 업데이트입니다. 빈 이미지 프롬프트로 이미지 첨부가 실패하는 흐름을 줄였습니다. 설치 후 실행기를 다시 연결해주세요.
AIMAX_WINDOWS_AGENT_RELEASE_NOTES=Windows 예리 이미지 프롬프트 보정 업데이트입니다. 빈 이미지 프롬프트로 이미지 첨부가 실패하는 흐름을 줄였습니다. 설치 후 실행기를 다시 연결해주세요.
```

Service restart:

```text
systemctl --user restart aimax-reports-api.service
systemctl --user is-active aimax-reports-api.service: active
Main PID after restart: 3443261
```

## Verification

Public version API:

```text
GET /api/version?platform=macos&current=v1.0.12
latest_version: v1.0.13
min_version: v1.0.13
update_required: true

GET /api/version?platform=macos&current=v1.0.13
latest_version: v1.0.13
min_version: v1.0.13
update_required: false

GET /api/version?platform=windows&current=v1.0.21
latest_version: v1.0.22
min_version: v1.0.22
update_required: true

GET /api/version?platform=windows&current=v1.0.22
latest_version: v1.0.22
min_version: v1.0.22
update_required: false
```

Health:

```text
GET http://127.0.0.1:18988/api/reports/health
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

R3-G is live.

Stop before R3-H unless the user explicitly approves the next phase.

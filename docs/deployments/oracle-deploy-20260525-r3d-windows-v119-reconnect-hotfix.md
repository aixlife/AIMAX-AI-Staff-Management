# Oracle Deploy 20260525 R3-D Windows v1.0.19 Reconnect Hotfix

- date: `2026-05-25 KST`
- scope: Windows bundle installer + Windows platform version env
- macOS runner: unchanged at `v1.0.11`
- R3-C claim flag: not enabled
- paid/API/Naver tests: not run

## Purpose

Deploy the Windows R3-D reconnect hotfix after the R3-C test-account check found that installed `v1.0.18` could fail to establish a fresh heartbeat and the web app could keep showing stale `v1.0.17` runner state.

The hotfix verified on Windows:

- request-file mismatch fixed for `aimax://agent/connect` and `aimax://agent/open-settings`
- dead-PID stale lock recovery verified
- fresh installed-runner heartbeat verified with a safe test account
- update-required banner clears on Windows `v1.0.19`
- no job creation/claim/execution
- no paid AI, Apify, or Naver mutation

## Source Artifact

Windows return folder:

```text
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-25-r3d-windows-reconnect-hotfix
```

Returned result:

```text
WINDOWS_RESULT_20260525_r3d_windows_reconnect_hotfix.md
```

Verdict:

```text
pass
```

Local staged artifact:

```text
dist/upload_installers/aimax-bundle-windows.exe
```

SHA256:

```text
c9f5f5586b2e6005886ff4d7335e03ccc121d2493d9901f7672df0dff767e392
```

## Remote Backup

Backup directory:

```text
/home/ubuntu/aimax-backups/20260525-r3d-v119-windows-reconnect-hotfix/
```

Previous Windows bundle hash:

```text
f4730bfa12fefd448c35e4fe66f7146110f3991db3dc79b792eb3bbd9f5c143e  /home/ubuntu/aimax-backups/20260525-r3d-v119-windows-reconnect-hotfix/aimax-bundle-windows.exe.prev
```

Previous env backup hash:

```text
85bb0e8891d22c654db22703132b66340f7642be61ecee9d014d2baf1d2ee899  /home/ubuntu/aimax-backups/20260525-r3d-v119-windows-reconnect-hotfix/.env.prev
```

## Remote Deployment

Remote target:

```text
/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe
```

Remote hash after deploy:

```text
c9f5f5586b2e6005886ff4d7335e03ccc121d2493d9901f7672df0dff767e392  /home/ubuntu/aimax-downloads/aimax-bundle-windows.exe
```

## Env Changes

Updated:

```text
AIMAX_WINDOWS_LATEST_AGENT_VERSION=v1.0.19
AIMAX_WINDOWS_MIN_AGENT_VERSION=v1.0.19
AIMAX_WINDOWS_AGENT_RELEASE_NOTES=Windows 실행기 재연결과 업데이트 배너 안정화 업데이트입니다. 설치 후 실행기 연결을 다시 눌러주세요.
```

Unchanged:

```text
AIMAX_MACOS_LATEST_AGENT_VERSION=v1.0.11
AIMAX_MACOS_MIN_AGENT_VERSION=v1.0.11
AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED is not set
AIMAX_YERI_SERVER_GENERATION_ENABLED is not set
```

## Service

Actual service is a user systemd unit:

```text
systemctl --user restart aimax-reports-api.service
systemctl --user is-active aimax-reports-api.service -> active
```

Note: the system-level unit name was not present; the running production process is managed by the `ubuntu` user service at:

```text
/home/ubuntu/.config/systemd/user/aimax-reports-api.service
```

## Verification

Internal health after restart:

```json
{"ok":true,"service":"aimax-reports-api","storage":{"ok":true,"checked_files":10,"issues":[],"recent_issues":[]}}
```

Public API:

```text
GET https://api.aimax.ai.kr/api/version?platform=windows&current=v1.0.18
latest_version=v1.0.19
min_version=v1.0.19
update_available=true
update_required=true
```

```text
GET https://api.aimax.ai.kr/api/version?platform=windows&current=v1.0.19
latest_version=v1.0.19
min_version=v1.0.19
update_available=false
update_required=false
```

```text
GET https://api.aimax.ai.kr/api/reports/health
ok=true
storage.ok=true
storage.issues=[]
```

## Next Gate

R3-C claim remains inactive.

Before enabling `AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED=1`:

1. Windows Codex should install from the live/public download path and verify `v1.0.19` fresh heartbeat and no update banner. Completed.
2. macOS should remain verified on `v1.0.11`.
3. Only after explicit user approval should claim be enabled.
4. Paid Gemini server generation remains disabled unless separately approved.

## Windows Live Post-Deploy Result

Return:

```text
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-25-r3d-windows-v119-post-deploy-check/WINDOWS_RESULT_20260525_r3d_windows_v119_post_deploy_check.md
```

Verdict:

```text
pass
```

Confirmed:

- live web/download API served `aimax-bundle-windows.exe`
- downloaded bytes: `136672261`
- downloaded SHA256: `c9f5f5586b2e6005886ff4d7335e03ccc121d2493d9901f7672df0dff767e392`
- installed diagnostics `system.app.version=v1.0.19`
- dashboard shows Windows runner `v1.0.19`
- update-required banner not observed
- fresh heartbeat status API: `connected`, `version=v1.0.19`, `update_required=false`
- `aimax://agent/connect` reaches already-running runtime
- `aimax://agent/open-settings` reaches already-running runtime
- stale dead-PID lock recovery verified
- no job created/claimed/executed
- no paid AI, Apify, or Naver mutation

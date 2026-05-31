# Oracle Deploy 20260528 R3-T Windows v1.0.30 Installer / Launcher Visibility

## Scope

- R3-T Windows hotfix rollout completed after owner approval.
- Windows unified runner: `v1.0.30`
- macOS release line left unchanged at `v1.0.17`
- Server code was not changed.
- Only the Windows bundle installer and Windows version API environment values were updated.
- No paid generation, job submit, Naver work, Apify, customer credential test, duplicate paid retry, or extra generation was run.

## Pre-Deploy Gate

R3-T Windows active-connection recheck passed:

- existing `v1.0.30` installer reused; no rebuild performed
- normal visible installer ran with explicit Inno `/LOG`
- visible installer progress/completion evidence captured
- uninstall entry showed `AIMAX 1.0.30`
- `aimax://` protocol registered to installed `aimax-agent-launcher.exe`
- launcher/open-settings behavior was visible
- production UI showed Windows runner `연결됨`, `v1.0.30`, and `최신 상태`
- sanitized version API check returned `update_required=false`

Evidence files:

- `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-28-r3t-windows-installer-launch-visibility/WINDOWS_RESULT_20260528_r3t_v130_active_connection_RECHECK.md`
- `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-28-r3t-windows-installer-launch-visibility/aimax_r3t_v130_active_connection_recheck_diag.json`

## Installer SHA256

Local staged hash:

```text
b1176a2a962ce34c36f7fc8bae57e6c22f578c61dcbe99d247ac8cc719716ec1  dist/upload_installers/aimax-bundle-windows.exe
```

Remote hash after deploy:

```text
b1176a2a962ce34c36f7fc8bae57e6c22f578c61dcbe99d247ac8cc719716ec1  /home/ubuntu/aimax-downloads/aimax-bundle-windows.exe
```

Authenticated public download stream verification:

```text
filename: aimax-bundle-windows.exe
content_length: 136669057
content_type: application/octet-stream
bytes_read: 136669057
sha256: b1176a2a962ce34c36f7fc8bae57e6c22f578c61dcbe99d247ac8cc719716ec1
```

## Remote Backup

Backup directory:

```text
/home/ubuntu/aimax-backups/20260528-r3t-v130-rollout/
```

Backed up before deploy:

```text
.env.before-r3t-v130
aimax-bundle-windows.exe.pre-r3t
SHA256SUMS.before.txt
```

Previous remote Windows installer hash:

```text
c0d95b51750c6994417d859eb864a65b600e66ec5ccf459644866cd8f3a2de54  /home/ubuntu/aimax-backups/20260528-r3t-v130-rollout/aimax-bundle-windows.exe.pre-r3t
```

## Env Changes

Updated `/home/ubuntu/aimax-reports-api/.env`:

```text
AIMAX_WINDOWS_LATEST_AGENT_VERSION=v1.0.30
AIMAX_WINDOWS_MIN_AGENT_VERSION=v1.0.30
AIMAX_WINDOWS_AGENT_RELEASE_NOTES=Windows 설치 및 실행기 가시성 업데이트입니다. 설치 진행률과 완료 후 실행기 연결 안내를 개선했습니다. 설치 후 실행기를 다시 연결해주세요.
```

Left unchanged:

```text
AIMAX_MACOS_LATEST_AGENT_VERSION=v1.0.17
AIMAX_MACOS_MIN_AGENT_VERSION=v1.0.17
```

## Service

Service restarted successfully.

```text
systemctl --user restart aimax-reports-api.service
systemctl --user is-active aimax-reports-api.service: active
```

## Verification

Internal Oracle health:

```text
{"ok":true,"service":"aimax-reports-api","storage":{"ok":true,"checked_files":10,"issues":[],"recent_issues":[]}}
```

Public and internal version API:

```text
Windows current v1.0.28 -> latest/min v1.0.30, update_required=true
Windows current v1.0.29 -> latest/min v1.0.30, update_required=true
Windows current v1.0.30 -> latest/min v1.0.30, update_required=false
macOS current v1.0.17 -> latest/min v1.0.17, update_required=false
```

Authenticated download options:

```text
aimax-bundle-windows.exe exists=true size=136669057
```

## Safety

- No paid generation was submitted.
- No job was submitted.
- No Apify call was made.
- No Naver publish, schedule, edit, or draft mutation was made.
- No customer credentials or customer Naver account were used.
- No raw secrets, cookies, browser profiles, signed URLs, or customer data were written into deployment evidence.

## Rollback

If rollback is required:

1. Restore `/home/ubuntu/aimax-backups/20260528-r3t-v130-rollout/aimax-bundle-windows.exe.pre-r3t` to `/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe`.
2. Restore `.env.before-r3t-v130` or set Windows latest/min back to the previous approved values.
3. Restart `aimax-reports-api.service`.


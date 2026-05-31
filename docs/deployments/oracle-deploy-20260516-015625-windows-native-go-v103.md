# Oracle Deploy 20260516-015625 Windows Native Go v1.0.3

- mode: `windows-installers`
- host: `oracle-server`
- app_dir: `/home/ubuntu/aimax-reports-api`
- download_dir: `/home/ubuntu/aimax-downloads`
- service: `aimax-reports-api.service`
- remote_backup: `/home/ubuntu/aimax-backups/20260516-native-go-v103`
- source_handoff: `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/AIMAX-20260515-native-go-launcher`

## Scope

Deployed the Windows-only v1.0.3 Local Agent installer rebuilds with the native Go launcher guard. macOS stays on v1.0.2.

The Windows v1.0.3 build addresses the repeated `aimax://agent/connect` and `open_settings` failure path by moving the single-instance/protocol guard in front of the PyInstaller/Tk runtime.

## Files

| label | remote | sha256 |
|---|---|---|
| bundle windows installer | `/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe` | `63bc82bf85ea0a03e8149e340586b8f6f765f99f8384dbdce2161626cad29c1d` |
| yeri windows installer | `/home/ubuntu/aimax-downloads/aimax-yeri-windows.exe` | `7e14e6476632bc92d97c6c1ef84ae559c24b2e41635ab471bd04e44488815935` |
| hyunju windows installer | `/home/ubuntu/aimax-downloads/aimax-hyunju-windows.exe` | `ebd16bd0738b708797c9320a739fe073c88741a4085001b68806fe2cdd3e5868` |

## Version Config

Updated `/home/ubuntu/aimax-reports-api/.env`:

```text
AIMAX_WINDOWS_LATEST_AGENT_VERSION=v1.0.3
AIMAX_WINDOWS_MIN_AGENT_VERSION=v1.0.3
AIMAX_MACOS_LATEST_AGENT_VERSION=v1.0.2
AIMAX_MACOS_MIN_AGENT_VERSION=v1.0.2
AIMAX_AGENT_RELEASE_NOTES="Windows 실행기 연결과 로컬 설정 열기 안정화 업데이트입니다."
```

Global `AIMAX_LATEST_AGENT_VERSION` and `AIMAX_MIN_AGENT_VERSION` remain `v1.0.2`; platform-specific overrides control the Windows rollout.
The release notes value was quoted after deploy so shell-based maintenance commands can safely source the file.

## Remote SHA

```text
63bc82bf85ea0a03e8149e340586b8f6f765f99f8384dbdce2161626cad29c1d  /home/ubuntu/aimax-downloads/aimax-bundle-windows.exe
ebd16bd0738b708797c9320a739fe073c88741a4085001b68806fe2cdd3e5868  /home/ubuntu/aimax-downloads/aimax-hyunju-windows.exe
7e14e6476632bc92d97c6c1ef84ae559c24b2e41635ab471bd04e44488815935  /home/ubuntu/aimax-downloads/aimax-yeri-windows.exe
```

## Verification

```text
GET /api/version?current=v1.0.2&platform=windows
latest=v1.0.3, minimum=v1.0.3, update_available=true, update_required=true

GET /api/version?current=v1.0.3&platform=windows
latest=v1.0.3, minimum=v1.0.3, update_available=false, update_required=false

GET /api/version?current=v1.0.2&platform=macos
latest=v1.0.2, minimum=v1.0.2, update_available=false, update_required=false

GET /api/reports/health
ok=true
```

Windows-side return verification reported:

- runtime diagnostics `system.app.version = v1.0.3`
- installer `DisplayVersion = 1.0.3`
- rapid native launcher tests: 20 launches -> 1 launcher process, 1 core process
- repeated `aimax://agent/connect` launches -> 1 launcher process, 1 core process
- local settings dialog regression: no `application has been destroyed`

## Result

Windows v1.0.3 native launcher rebuild is deployed to Oracle and exposed as a required Windows update. macOS remains unchanged at v1.0.2.

## Support Follow-Up

The three open Windows-related report records from 2026-05-14 were moved from `new` to `waiting_user` with user-facing guidance:

| report_id | status | user-facing action |
|---|---|---|
| `AIMAX-RPT-20260514083437-5731089e` | `waiting_user` | Install the latest Windows build and retry launcher connection. |
| `AIMAX-RPT-20260514095338-480d0ce4` | `waiting_user` | Install the latest Windows build and retry Yeri execution. |
| `AIMAX-RPT-20260514100940-3d7cf508` | `waiting_user` | Save at least one neighbor request message in the web app settings tab, then retry. |

# Oracle Deploy 20260529 v1.0.33 Songi Server Fallback

## Scope

- Deployed Oracle web/server changes for Songi YouTube server fallback.
- Deployed Windows unified installer `v1.0.33`.
- Updated Windows version metadata to latest/min `v1.0.33`.
- macOS installer/version policy stayed `v1.0.17`.
- No paid AI, Apify, YouTube Data API, Naver publish/schedule/edit/save, customer credential use, or duplicate paid retry was performed.

## Local Staged Hashes

```text
1040c7960607fb01f948dd94bb13556cd33533fa8000ee49cc3ea9de4b28378e  oracle/aimax-reports-api/server.js
0f4a51eee29d55b6699d899f96025f382ef35a845ad1657221080772a712d684  oracle/aimax-reports-api/static/app.html
48abebd71f44b55a3b65a45745f849c5312627a15a046130f7ffb9efb3a86cbc  dist/upload_installers/aimax-bundle-windows.exe
```

Previous local Windows installer was archived at:

```text
dist/upload_installers/archive-windows-20260529-pre-v133-songi-server-fallback/aimax-bundle-windows.exe
```

## Remote Backup

Backup directory:

```text
/home/ubuntu/aimax-backups/20260529-v133-songi-server-fallback/
```

Backed up before deploy:

```text
9e87e55e0de8094027d81683d61a5a4f6562f79f10f185e8f38f02fb62101a36  server.js.pre-v133
0c85262318819f59d62a4c6c2d30cde5a2044d144cf1bed0a06baa1442958414  app.html.pre-v133
264418c71ac013da8b8496737bfc315ccb410a87946009b8371ba05d933fc0eb  aimax-bundle-windows.exe.pre-v133
.env.pre-v133
```

## Remote Deployed Hashes

```text
1040c7960607fb01f948dd94bb13556cd33533fa8000ee49cc3ea9de4b28378e  /home/ubuntu/aimax-reports-api/server.js
0f4a51eee29d55b6699d899f96025f382ef35a845ad1657221080772a712d684  /home/ubuntu/aimax-reports-api/static/app.html
48abebd71f44b55a3b65a45745f849c5312627a15a046130f7ffb9efb3a86cbc  /home/ubuntu/aimax-downloads/aimax-bundle-windows.exe
```

Remote Windows installer size:

```text
35,625,438 bytes
```

## Version API

Updated `/home/ubuntu/aimax-reports-api/.env`:

```text
AIMAX_WINDOWS_LATEST_AGENT_VERSION=v1.0.33
AIMAX_WINDOWS_MIN_AGENT_VERSION=v1.0.33
AIMAX_WINDOWS_AGENT_RELEASE_NOTES=Windows 실행기 v1.0.33 업데이트입니다. 송이 YouTube 찾기는 서버 공개 검색 fallback으로 먼저 처리되고, 실행기 연결/중복 실행/터미널 팝업 안정성을 개선했습니다. 설치 후 실행기를 다시 연결해주세요.
```

macOS stayed:

```text
AIMAX_MACOS_LATEST_AGENT_VERSION=v1.0.17
AIMAX_MACOS_MIN_AGENT_VERSION=v1.0.17
```

Public version checks:

```text
Windows current v1.0.32 -> latest/min v1.0.33, update_required=true
Windows current v1.0.33 -> latest/min v1.0.33, update_required=false
macOS current v1.0.17 -> latest/min v1.0.17, update_required=false
```

## Health And Production Smoke

- Service restart: `systemctl --user is-active aimax-reports-api.service` returned `active`.
- Internal health: passed.
- Public health: passed.
- Server `yt-dlp --version`: `2024.04.09`.
- Public `yt-dlp --skip-download` search: returned a YouTube result.

Production API smoke used a temporary test user, then removed the user/session/research rows. Cleanup verification showed:

```json
{"smoke_users":0,"smoke_projects":0,"smoke_runs":0}
```

Songi discovery production smoke result:

```json
{
  "ok": true,
  "youtube": {
    "configured": true,
    "server_configured": true,
    "execution_mode": "server_ytdlp"
  },
  "discovery": {
    "pending_runner": false,
    "source_mode": "server_ytdlp",
    "status": "completed",
    "candidate_count": 5,
    "first_badge": "웹 공개 검색"
  }
}
```

## Error Report Status

Report `AIMAX-RPT-20260528155140-2843fd6d` was moved to:

```text
waiting_user / 사용자 확인 필요
```

User-facing message now says the deploy is complete and asks the user to refresh the web app and retry Songi YouTube keyword search.

## Safety

- No paid AI generation was submitted.
- No Apify call was made.
- No YouTube Data API key or quota was used.
- No video download was performed.
- No Naver publish, schedule, draft save, edit, or customer credential action was performed.
- The existing paid/server-generation job `1131624c-db33-4fab-9366-43c997a9b430` was not resumed or claimed.

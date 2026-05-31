# Oracle Deploy 20260528 Songi YouTube Discovery v1.0.31

## Scope

- Deployed Songi keyword-based YouTube discovery workflow to the Oracle AIMAX web app.
- Deployed Windows unified runner installer `v1.0.31`.
- macOS installer/version policy was not changed.
- No paid generation, Apify, YouTube Data API, Naver publish/schedule/draft/edit/save, customer credentials, or duplicate paid retry was performed.

## Windows Gate

Returned Windows result: `PASS`.

- Source bundle SHA256: `2d8bdfc3294154b92612c78173cae7d40d35984f405022231d106cfd0662b1d4`
- Installer SHA256: `264418c71ac013da8b8496737bfc315ccb410a87946009b8371ba05d933fc0eb`
- Installer size: `129,526,161` bytes
- Installed version: `AIMAX 1.0.31`
- Visible installer wizard: passed
- `aimax://` protocol registration: passed
- Launcher diagnostics: `launcher_version = v1.0.31`
- `node scripts/smoke_songi_discovery.mjs`: `SONGI_DISCOVERY_SMOKE_OK`
- `yt-dlp --skip-download` metadata lookup: passed, no video download
- Songi UI: 8 cards in 3-column grid, text overflow 0, keyword/link tabs separated

Evidence copied to:

`docs/testing/evidence/songi-v131-release-20260528/`

## Local Staged Hashes

```text
b1176a2a962ce34c36f7fc8bae57e6c22f578c61dcbe99d247ac8cc719716ec1  dist/upload_installers/archive-windows-20260528-pre-v131-songi-youtube-discovery/aimax-bundle-windows.exe
264418c71ac013da8b8496737bfc315ccb410a87946009b8371ba05d933fc0eb  dist/upload_installers/aimax-bundle-windows.exe
b13a9eff47378af827fcb8c0d8207661d5ac06f4b75eebcefcab3eae2ae6db77  dist/upload_installers/aimax-bundle-macos.dmg
cf6f822ee06f50e01cae81a6bf3a7ef6260de9b6ee678c7c4945b46821ae63b9  oracle/aimax-reports-api/server.js
cbc97ec008d28d98c65b91e459082f80859e124cbf215f9422bd3b5087fbc1cb  oracle/aimax-reports-api/static/app.html
```

## Remote Backup

Backup directory:

```text
/home/ubuntu/aimax-backups/20260528-songi-youtube-v131-release/
```

Backed up before deploy:

```text
28c2e304be317344824f26f0aa1b46f7e5bf92a6025b07c66a7824c3ebeefe7f  server.js.pre-v131
12ce7fd5d024b00fd4038312b81d89c07a3b9dc0658899cd40d8a813de7104f1  app.html.pre-v131
b1176a2a962ce34c36f7fc8bae57e6c22f578c61dcbe99d247ac8cc719716ec1  aimax-bundle-windows.exe.pre-v131
```

## Remote Deployed Hashes

```text
264418c71ac013da8b8496737bfc315ccb410a87946009b8371ba05d933fc0eb  /home/ubuntu/aimax-downloads/aimax-bundle-windows.exe
b13a9eff47378af827fcb8c0d8207661d5ac06f4b75eebcefcab3eae2ae6db77  /home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg
cf6f822ee06f50e01cae81a6bf3a7ef6260de9b6ee678c7c4945b46821ae63b9  /home/ubuntu/aimax-reports-api/server.js
cbc97ec008d28d98c65b91e459082f80859e124cbf215f9422bd3b5087fbc1cb  /home/ubuntu/aimax-reports-api/static/app.html
```

Remote sizes:

```text
124M  /home/ubuntu/aimax-downloads/aimax-bundle-windows.exe
63M   /home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg
```

## Version API

Updated `/home/ubuntu/aimax-reports-api/.env`:

```text
AIMAX_WINDOWS_LATEST_AGENT_VERSION=v1.0.31
AIMAX_WINDOWS_MIN_AGENT_VERSION=v1.0.31
AIMAX_WINDOWS_AGENT_RELEASE_NOTES=Windows 송이 키워드 YouTube 벤치마킹 업데이트입니다. 키워드로 찾기 탭과 로컬 공개 검색을 추가했습니다. 설치 후 실행기를 다시 연결해주세요.
```

macOS stayed:

```text
AIMAX_MACOS_LATEST_AGENT_VERSION=v1.0.17
AIMAX_MACOS_MIN_AGENT_VERSION=v1.0.17
```

Public version checks:

```text
Windows current v1.0.30 -> latest/min v1.0.31, update_required=true
Windows current v1.0.31 -> latest/min v1.0.31, update_required=false
macOS current v1.0.17 -> latest/min v1.0.17, update_required=false
```

## Health And UI Verification

Service:

```text
systemctl --user is-active aimax-reports-api.service: active
```

Internal and public health:

```json
{"ok":true,"service":"aimax-reports-api","storage":{"ok":true,"checked_files":10,"issues":[],"recent_issues":[]}}
```

Public `/app` content checks passed:

```json
{
  "hasSongiTitle": true,
  "hasKeywordTab": true,
  "hasLinkTab": true,
  "hasDiscoveryProject": true,
  "hasDiscoveryResults": true,
  "hasYoutubeCommand": true
}
```

Authenticated download-options UI check was not completed because the stored demo credential used for local smokes is no longer valid against production. File availability was verified by deployed download hash/size and version API; Windows installed-user UI verification was already completed by the Windows gate.

## Safety

- No paid AI generation was submitted.
- No Apify call was made.
- No YouTube Data API key or quota was used.
- No video download was performed; Windows gate used `yt-dlp --skip-download` metadata only.
- No Naver publish, schedule, draft save, edit, or customer credential action was performed.
- Temporary upload files under `/tmp` were removed after deploy.

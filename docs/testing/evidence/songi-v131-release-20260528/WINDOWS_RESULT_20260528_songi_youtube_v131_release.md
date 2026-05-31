# WINDOWS RESULT 2026-05-28 - Songi YouTube Discovery v1.0.31 Release

## Summary

Built and verified AIMAX Windows runner **v1.0.31** from imax_songi_youtube_v131_release_source_20260528.zip after copying it out of Syncthing into the local Windows work folder.

Result: **PASS**

## Build Artifacts

- Installer: imax-bundle-windows.exe
- Installer SHA256: $installerHash
- Installer size: 129,526,161 bytes
- Signature: unsigned / NotSigned (no signing certificate configured in this local build)
- Dist zip: dist\AIMAX-windows.zip

## Required Version Updates

- imax_compliance.py: APP_VERSION = "v1.0.31"
- split_version\aimax_compliance.py: APP_VERSION = "v1.0.31"
- Inno AppVersion: 1.0.31
- Go launcher diagnostics launcherVersion: 1.0.31

## Verification

- python -m py_compile app.py split_version/app.py local_agent/runtime.py scripts/dev_songi_discovery_runner.py aimax_compliance.py split_version/aimax_compliance.py: PASS
- 
ode --check oracle/aimax-reports-api/server.js: PASS
- 
ode --check scripts/smoke_songi_discovery.mjs: PASS
- gofmt -w packaging/windows/aimax_agent_launcher.go: PASS
- python build.py: PASS
- 
ode scripts/smoke_songi_discovery.mjs: PASS (SONGI_DISCOVERY_SMOKE_OK)
- yt-dlp --skip-download metadata lookup via local media-tools fallback: PASS (yt-dlp 2026.03.17, 3 metadata rows, no download)

## Installer / Runtime Verification

- Visible installer wizard: PASS
  - First visible window: 3.382s
  - Window title: 설치 - AIMAX 버전 1.0.31
  - Exit code: 0
- Windows uninstall entry: PASS
  - DisplayName = AIMAX 버전 1.0.31
  - DisplayVersion = 1.0.31
- imax:// protocol: PASS
  - Command: "C:\Users\likim\AppData\Local\Programs\AIMAX\aimax-agent-launcher.exe" "%1"
- Launcher/connect visible guidance: PASS
  - Seen windows included AIMAX 실행 중 and browser AIMAX
  - Diagnostics tail contains launcher_version = v1.0.31
- Installed UI payload hash: PASS
  - pp.html source/dist/installed hashes match
  - server.js source/dist/installed hashes match

## Songi UI Verification

- 작업 > 송이 actual browser check: PASS
- 송이 제목 바로 아래 task tabs: PASS
- Active keyword tab: $(@{ok=True; baseUrl=http://127.0.0.1:19741; projectId=7276e2e1-3b4f-4ce6-b860-24c58086a899; runId=79623ffb-2f6d-4801-973f-a1dbba6d4fce; apiCandidateCount=8; commandType=songi_youtube_discovery; sourceMode=local_ytdlp; noPaidEnvBlank=True; keywordChecks=; linkChecks=; screenshots=; serverStdout=aimax-reports-api listening on http://127.0.0.1:19741; serverStderr=; chromeStderrTail=
DevTools listening on ws://127.0.0.1:19742/devtools/browser/ff3acdeb-c8d2-4196-adc0-5b8d0ea8e8ae
[24852:69500:0528/165142.930:ERROR:google_apis\gcm\engine\registration_request.cc:291] Registration response error message: DEPRECATED_ENDPOINT
}.keywordChecks.activeTaskTab)
- Keyword tab has no profile/category/topic fields: PASS
- Candidate cards rendered: 8
- Responsive grid columns: 3
- Text overflow findings: 0
- Link tab preserves existing workflow: PASS
  - Active link tab: $(@{ok=True; baseUrl=http://127.0.0.1:19741; projectId=7276e2e1-3b4f-4ce6-b860-24c58086a899; runId=79623ffb-2f6d-4801-973f-a1dbba6d4fce; apiCandidateCount=8; commandType=songi_youtube_discovery; sourceMode=local_ytdlp; noPaidEnvBlank=True; keywordChecks=; linkChecks=; screenshots=; serverStdout=aimax-reports-api listening on http://127.0.0.1:19741; serverStderr=; chromeStderrTail=
DevTools listening on ws://127.0.0.1:19742/devtools/browser/ff3acdeb-c8d2-4196-adc0-5b8d0ea8e8ae
[24852:69500:0528/165142.930:ERROR:google_apis\gcm\engine\registration_request.cc:291] Registration response error message: DEPRECATED_ENDPOINT
}.linkChecks.activeTaskTab)
  - Project/profile/category/topic/link/instruction flow present: True

## Returned Files

- WINDOWS_RESULT_20260528_songi_youtube_v131_release.md
- imax_songi_youtube_v131_release_diag.json
- imax-bundle-windows.exe
- installer-v131.sanitized.log
- imax-bundle-windows.exe.sha256
- songi-keyword-board-windows.png
- songi-link-workflow-windows.png
- installer-visible-initial-v131.png
- installer-visible-completed-v131.png

## Safety Notes

No Apify, paid AI generation, YouTube Data API, Naver publish/schedule/draft/edit/save/customer credential action, live Oracle deploy, or Oracle version API change was performed. Shared artifacts are sanitized and do not include secrets/cookies/signed URLs.

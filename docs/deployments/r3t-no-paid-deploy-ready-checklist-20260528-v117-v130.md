# AIMAX R3-T No-Paid Deploy-Ready Checklist

Date: 2026-05-28 KST

## Status

R3-T Windows installer/launcher visibility recheck passed with the existing `v1.0.30` installer. The Windows installer is staged locally for deployment approval.

Do not live deploy yet. Do not change the Oracle version API yet. Do not run paid generation, Naver publish/schedule/draft work, Apify, customer credential tests, or duplicate paid retries without separate approval.

## Candidate Installers

- macOS staged installer: `dist/upload_installers/aimax-bundle-macos.dmg`
- macOS current release line: `v1.0.17` (unchanged by R3-T)
- Windows staged installer: `dist/upload_installers/aimax-bundle-windows.exe`
- Windows candidate version: `v1.0.30`
- Windows SHA256: `b1176a2a962ce34c36f7fc8bae57e6c22f578c61dcbe99d247ac8cc719716ec1`

Previous Windows staged installer archived:

- `dist/upload_installers/archive-windows-20260528-pre-v130-r3t-installer-launch-visibility/aimax-bundle-windows.exe`
- archived SHA256: `c0d95b51750c6994417d859eb864a65b600e66ec5ccf459644866cd8f3a2de54`

## Windows R3-T Evidence

Returned from:

- `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-28-r3t-windows-installer-launch-visibility/`

Files:

- `WINDOWS_RESULT_20260528_r3t_v130_active_connection_RECHECK.md`
- `aimax_r3t_v130_active_connection_recheck_diag.json`
- `installer_visible_recheck_evidence.json`
- `open_settings_visible_recheck_evidence.json`
- `production_ui_active_connection_summary.json`
- `aimax-bundle-windows.exe`

Pass evidence:

- existing `v1.0.30` installer reused; no rebuild performed
- installer SHA256 matched `B1176A2A962CE34C36F7FC8BAE57E6C22F578C61DCBE99D247AC8CC719716EC1`
- normal non-silent installer ran with explicit Inno `/LOG`
- visible `AIMAX 설치` window appeared
- visible installer pages included `추가 작업 선택`, `설치 준비 완료`, and `설치 중`
- visible progress text included `파일을 추출하는 중...`
- setup log reported `Installation process succeeded.`
- setup log wrote `HKCU\Software\Classes\aimax` protocol keys
- setup log created uninstall key `kr.makefamily.aimax_is1`
- post-install run entry executed `aimax-agent-launcher.exe aimax://agent/connect`
- uninstall entry shows `AIMAX 1.0.30`
- `aimax://` protocol command points to installed `aimax-agent-launcher.exe`
- launcher diagnostics show `launcher_started`, `core_detected`, `request_written`, `core_started`, and `launcher_handoff`
- installed runtime stayed alive as `AIMAX.exe`
- `aimax://agent/open-settings` opened visible `AIMAX 로컬 보안 설정`
- production web UI dashboard showed `연결됨`, `AIXLIFE (Windows)`, `v1.0.30`, and `실행기 업데이트` / `최신`
- production settings showed `연결됨`, last seen `05. 28. 오전 09:28`, and `v1.0.30`
- production update page showed `최신 상태`, current `v1.0.30`, latest `v1.0.28`, minimum `v1.0.28`, and a message that the connected runner satisfies the latest requirement
- sanitized production version API check returned `update_required=false`
- no paid generation, job submit, Naver work, Apify, live deploy, Oracle version API change, customer credentials, or duplicate paid retry
- returned evidence contains no secrets, cookies, browser profiles, signed URLs, customer credentials, or Naver session data

## Remaining Gate

R3-T is no-paid deploy-ready for the Windows installer hotfix, pending explicit owner approval for live deployment and Oracle version API changes.

Recommended next approval scope:

- upload staged Windows `v1.0.30` installer to Oracle
- update Windows version metadata so production can offer `v1.0.30`
- consider setting Windows minimum version to `v1.0.30` because `v1.0.28` had installer/bootstrap visibility and post-install launcher visibility risk
- leave macOS unchanged unless a separate macOS change is approved
- run no-paid post-deploy verification only

## Rollback Notes

No live deployment was performed while preparing this checklist.

If deployment is approved, back up the current Oracle installer and version metadata before upload/version API changes. Keep the archived local `v1.0.28` installer until post-deploy Windows no-paid verification passes.


# Oracle Deploy 20260528 R3-R macOS v1.0.17 / Windows v1.0.28 Rollout

## Scope

- R3-R live rollout completed after owner approval.
- macOS unified runner: `v1.0.17`
- Windows unified runner: `v1.0.28`
- Server code was not changed in this deploy pass.
- Installer files and platform version API environment values were updated.
- No paid job, Apify, Naver publish, Naver schedule, customer credential test, or extra generation was run during deployment verification.

## Pre-Deploy Gate

R3-Q Windows paid visible-browser actual user-flow passed with a caveat:

- account: `demo@aimax.ai.kr`
- job id: `59ce602e-a765-4f67-94a9-28023757a298`
- selected flow: Yeri, `gemini-2.5-flash`, 800 chars, image 1, 임시 저장 only
- exactly one paid job submitted
- UI estimate: 62 KRW
- final cost: 137 KRW, below the 500 KRW cap
- final server status: `done`
- runner claim/start/done evidence captured
- Naver automatic login, Smart Editor open, title/body/image insert, and draft-save path completed

Caveat accepted for rollout: Gemini text succeeded, but Gemini image returned quota 429 and the configured OpenAI image fallback produced the inserted image.

## Installer SHA256

Local staged hashes:

```text
b13a9eff47378af827fcb8c0d8207661d5ac06f4b75eebcefcab3eae2ae6db77  dist/upload_installers/aimax-bundle-macos.dmg
c0d95b51750c6994417d859eb864a65b600e66ec5ccf459644866cd8f3a2de54  dist/upload_installers/aimax-bundle-windows.exe
```

Remote hashes after deploy:

```text
b13a9eff47378af827fcb8c0d8207661d5ac06f4b75eebcefcab3eae2ae6db77  /home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg
c0d95b51750c6994417d859eb864a65b600e66ec5ccf459644866cd8f3a2de54  /home/ubuntu/aimax-downloads/aimax-bundle-windows.exe
```

Remote sizes after deploy:

```text
63M   /home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg
131M  /home/ubuntu/aimax-downloads/aimax-bundle-windows.exe
```

## Remote Backup

Backup directory:

```text
/home/ubuntu/aimax-backups/20260528-r3r-v117-v128-rollout/
```

Backed up before deploy:

```text
.env.pre-r3r
.env.before-r3r-version-update
aimax-bundle-macos.dmg.pre-r3r
aimax-bundle-windows.exe.pre-r3r
```

Previous remote installer hashes:

```text
6a99813dcb98ed52b38edf51a4bea01786dcbceb0d991d941c73da5beef6c0e6  aimax-bundle-macos.dmg.pre-r3r
31ddbb245569b5cb7a8bed0bd656a0d82b927f26c8ca16f79b641496c3cc3962  aimax-bundle-windows.exe.pre-r3r
```

## Env Changes

Updated `/home/ubuntu/aimax-reports-api/.env`:

```text
AIMAX_MACOS_LATEST_AGENT_VERSION=v1.0.17
AIMAX_MACOS_MIN_AGENT_VERSION=v1.0.17
AIMAX_WINDOWS_LATEST_AGENT_VERSION=v1.0.28
AIMAX_WINDOWS_MIN_AGENT_VERSION=v1.0.28
AIMAX_MACOS_AGENT_RELEASE_NOTES=Mac 실행기 안정화 업데이트입니다. 실제 사용자 흐름 진단과 예리 실행 안정성을 개선했습니다. 설치 후 실행기를 다시 연결해주세요.
AIMAX_WINDOWS_AGENT_RELEASE_NOTES=Windows 실행기 안정화 업데이트입니다. 로컬 설정 저장, AppData 복구, 작업 시작 감시, 예리 임시저장 흐름을 개선했습니다. 설치 후 실행기를 다시 연결해주세요.
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

Public health:

```text
{"ok":true,"service":"aimax-reports-api","storage":{"ok":true,"checked_files":10,"issues":[],"recent_issues":[]}}
```

Version API:

```text
macOS current v1.0.16 -> latest/min v1.0.17, update_required=true
macOS current v1.0.17 -> latest/min v1.0.17, update_required=false
Windows current v1.0.27 -> latest/min v1.0.28, update_required=true
Windows current v1.0.28 -> latest/min v1.0.28, update_required=false
```

Authenticated download options:

```text
aimax-bundle-macos.dmg exists=true size=65491859
aimax-bundle-windows.exe exists=true size=136656846
```

Post-deploy production web UI no-paid check:

- URL: `https://api.aimax.ai.kr/app`
- account: `demo@aimax.ai.kr`
- app opened in logged-in view
- updates tab showed macOS current/latest/min `v1.0.17`
- global/update notices were hidden for current macOS `v1.0.17`
- environment diagnostics included `local_state`
- screenshot: `docs/testing/evidence/r3r-post-deploy-20260528/overview.png`

Observed non-blocking item:

- The demo account still has an old report attention prompt for `AIMAX-RPT-20260522185718-6fe2df2a`. It was dismissible with "later" and is not an R3-R deploy blocker, but should be cleaned up or closed in R3-S if stale.

## Safety

- No extra paid generation was submitted during deployment.
- No Apify call was made.
- No Naver publish, schedule, edit, or draft mutation was made during deployment.
- No customer credentials or customer Naver account were used.
- No raw secrets, cookies, browser profiles, or signed URLs were written into deployment evidence.

## Next Phase

R3-S: post-deploy monitoring and stale-report cleanup.

Suggested scope:

1. Check new error reports after the R3-R rollout.
2. Close or update stale report attention prompts that refer to already-fixed issues.
3. Verify customers with old Mac/Windows runners see the correct update-required state.
4. Keep paid generation disabled for further testing unless a new concrete paid scope is approved.

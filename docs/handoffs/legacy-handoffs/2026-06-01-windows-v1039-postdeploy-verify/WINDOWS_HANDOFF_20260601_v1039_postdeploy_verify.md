# Windows Handoff - v1.0.39 Post-Deploy Verification

Date: 2026-06-01 KST
From: Mac/Oracle Codex
To: Windows Codex

## Context

Windows Local Agent v1.0.39 was deployed to Oracle production as required/latest.

Expected production version API:

```text
AIMAX_WINDOWS_LATEST_AGENT_VERSION=v1.0.39
AIMAX_WINDOWS_MIN_AGENT_VERSION=v1.0.39
release notes: 실행기 재시작 시 바로 종료되는 문제, 버전이 하이픈으로 표시되는 문제 수정
```

Expected deployed installer:

```text
URL: https://api.aimax.ai.kr/api/download/agent?...
remote file: /home/ubuntu/aimax-downloads/aimax-bundle-windows.exe
SHA256: d71571488977588e2e25171360dfe2f47be5ef477d26c19744daa36982ec9bfc
size: 35,669,809 bytes
```

Deploy logs:

```text
docs/deployments/oracle-deploy-20260601-203609.md
docs/deployments/oracle-deploy-20260601-203907.md
```

## Verification Task

1. Open the production AIMAX web app on Windows.
2. Use an approved existing test account/session. Do not store or report passwords, cookies, tokens, API keys, or Naver credentials.
3. Confirm `/api/version?current=v1.0.38&platform=windows` returns latest/min `v1.0.39` and `update_required=true`.
4. From the web UI, open `업데이트 및 오류보고` and confirm the Windows update/download flow points to the v1.0.39 bundle.
5. Download the Windows bundle and verify SHA256 is `d71571488977588e2e25171360dfe2f47be5ef477d26c19744daa36982ec9bfc`.
6. Install over the existing runner if safe in the Windows test environment.
7. Verify the installed runner reports `v1.0.39` in the web UI.
8. If feasible, reproduce the stale-lock scenario safely:
   - ensure no live AIMAX runner process remains,
   - leave or simulate a stale single-instance lock only if safe,
   - launch AIMAX and verify it does not immediately exit with version `-`.
9. Also spot-check `직원 채용` on a limited-entitlement account: initial `전체` should show the full runnable staff catalog, while `권한 없음` should filter to unavailable employees.

## Return Expectations

Write a result Markdown file back to this folder with:

- Windows version/build
- installed AIMAX version
- downloaded installer SHA256
- visible UI evidence or screenshots
- stale-lock scenario result, or why it could not be safely reproduced
- any blockers

No paid AI/API calls, Apify runs, Naver publish/schedule actions, customer credentials, secrets, or raw tokens.

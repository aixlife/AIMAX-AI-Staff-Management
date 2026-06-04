You are the Windows AI developer for AIMAX.

Read the latest handoff docs in:

```text
C:\Users\aixlife\Documents\Shared-Bridge\20_Deploy-To-Windows\2026-06-01-windows-v1039-postdeploy-verify\
```

Do not build or edit inside the Syncthing shared folder. If source is needed, copy it to a local Windows work folder first. Do not put secrets, passphrases, API keys, cookies, session tokens, Naver credentials, or customer private data in Syncthing.

Task:

1. Verify production `/api/version?current=v1.0.38&platform=windows` returns latest/min `v1.0.39` and `update_required=true`.
2. Open production AIMAX on Windows with the approved test session.
3. Check the update/download UI for the v1.0.39 Windows bundle.
4. Download the bundle and verify SHA256:
   `d71571488977588e2e25171360dfe2f47be5ef477d26c19744daa36982ec9bfc`
5. Install over the existing runner if safe.
6. Confirm the web UI sees installed runner `v1.0.39`.
7. Safely verify the stale single-instance lock fix if possible: AIMAX should not immediately exit or show version `-` just because a stale lock file remains.
8. Spot-check `직원 채용`: initial `전체` should show all runnable staff, while `권한 없음` should filter unavailable staff.

Return a result Markdown file to the same Syncthing folder with screenshots/evidence, SHA256, installed version, stale-lock result or blocker, and any remaining issues. Do not run paid AI/API jobs, Apify, or Naver publish/schedule actions.

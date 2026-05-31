Read first:

`20_Deploy-To-Windows\2026-05-22-web-secret-songi-followup\WINDOWS_COMPLETION_20260522_web_secret_songi_followup.md`

`20_Deploy-To-Windows\2026-05-22-apify-local-settings-runtime-mismatch\WINDOWS_AI_DEVELOPER_MESSAGE_20260522_apify_local_settings_mismatch.md`

`20_Deploy-To-Windows\2026-05-22-v116-web-secret-notice-rebuild\MAC_COMPLETION_20260522_v116_web_secret_notice_ready.md`

`20_Deploy-To-Windows\2026-05-22-v116-web-secret-notice-rebuild\WINDOWS_HANDOFF_20260522_v116_web_secret_notice_rebuild.md`

Task:

Prepare and verify a Windows installer rebuild for the latest AIMAX web-secret/Songi settings UX changes.

Important:

- Copy the provided `source-files` out of Syncthing into a local Windows work folder before editing/building.
- Do not build inside the shared folder.
- Do not place secrets, passphrases, `.env`, cookies, browser profiles, signed URLs, or raw private logs in Syncthing.
- Do not run paid AI calls.
- Do not run Apify Actors.
- Do not run real Naver publish/save tests.
- Use Claude/Gemini only as sanitized advisory reviewers if already available. Do not send customer data or secrets.
- Keep the current Windows version as the source of truth. If current Windows is `v1.0.15`, rebuild as `v1.0.16`. Do not copy any older Mac version value that would downgrade the installer.

Apply/check:

- `app.py`
- `split_version\app.py`
- `local_agent\runtime.py`
- If the Windows installer/package embeds or validates web files, also sync:
  - `oracle\aimax-reports-api\static\app.html`
  - `oracle\aimax-reports-api\server.js`

Required no-paid validation:

```powershell
python -m py_compile .\app.py .\split_version\app.py .\local_agent\runtime.py
node --check .\oracle\aimax-reports-api\server.js
node -e "const fs=require('fs'),vm=require('vm'); const html=fs.readFileSync('oracle/aimax-reports-api/static/app.html','utf8'); const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]); for (const script of scripts) new vm.Script(script); console.log('APP_HTML_SCRIPT_SYNTAX_OK');"
Select-String -Path .\app.py,.\split_version\app.py,.\local_agent\runtime.py -Pattern "로컬 실행기 작업용","웹 설정 탭의 AI/API 연결"
Select-String -Path .\oracle\aimax-reports-api\static\app.html -Pattern "AIMAX 설정 방식이 더 쉬워졌습니다","WEB_SECRET_NOTICE_KEY","AI/API 연결"
```

Manual smoke after rebuild/install:

- App version did not downgrade.
- Local settings window is usable and bottom save/cancel buttons are visible or reachable.
- Local settings clearly says local AI/API keys are for blog-team local runner work, while Songi provider keys are managed in web `설정 > AI/API 연결`.
- AIMAX web login/password IME guard from v1.0.15 still works.
- Login success does not leave the user in infinite loading.
- Download/local-settings UX hotfix from v1.0.15 still works.
- No paid provider calls, no Apify Actor, no Naver save/publish.

Return to:

`20_Deploy-To-Windows\2026-05-22-v116-web-secret-notice-rebuild`

Return files:

- `WINDOWS_COMPLETION_20260522_v116_web_secret_notice_rebuild.md`
- rebuilt installer artifact or exact artifact path
- SHA256 of artifact
- build log summary
- validation output summary
- any blocker/risk

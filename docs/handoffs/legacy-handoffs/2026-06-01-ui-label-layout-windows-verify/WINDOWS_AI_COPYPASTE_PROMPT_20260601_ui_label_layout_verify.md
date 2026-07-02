Read the latest handoff docs in the Syncthing folder first, especially `WINDOWS_HANDOFF_20260601_ui_label_layout_verify.md`.

Task: verify the deployed AIMAX production web UI on Windows after the Mac-side web-only deploy.

Production URL: `https://api.aimax.ai.kr/app`

Rules:
- Use the installed Windows AIMAX unified runner and the approved safe test account/session already available on Windows.
- Do not use customer credentials.
- Do not run paid AI generation, Apify paid collection, Naver publish, or Naver scheduling.
- No source build is requested. If you decide source inspection is necessary, copy source out of Syncthing into a local Windows work folder first and do not build inside the shared folder.
- Keep secrets, passphrases, tokens, and raw session data out of Syncthing.

Verify:
1. Sidebar labels are now `대시보드`, `직원 채용`, `직원 업무지시`, `설정`, `업데이트 및 오류보고`.
2. `직원 업무지시` opens the jobs screen through preserved `data-tab="jobs"` behavior and job forms still appear according to entitlement/readiness.
3. Desktop dashboard stacks vertically like mobile: office explanation first, AIMAX Brain video below it, with the video larger/wider than the old right-side layout.
4. Desktop staff page stacks vertically like mobile: employee cards first, selected employee detail below the cards, not sticky on the right.
5. `설정` still shows local settings and `로컬 설정 열기`.
6. `업데이트 및 오류보고` still shows update/download information, the error report form, and my report list.
7. Check whether any Windows smoke script or visible-text automation still expects literal `직원` or `일시키기`; list any breakage.

Return a Markdown result file to this same Syncthing folder with:
- Windows code change needed: yes/no
- Installed runner version and platform
- Account label/email only, no password/token
- Screenshots or visible text evidence
- Any selector/text regression
- Confirmation no secrets were placed in Syncthing
- Confirmation no paid AI, Apify paid collection, Naver publish, or schedule action was run


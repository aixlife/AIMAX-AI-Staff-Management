Read first:
`MAC_COMPLETION_20260522_web_secret_songi_deployed.md`
`WINDOWS_HANDOFF_20260522_web_secret_songi_followup.md`

Goal:
Verify the Windows side after the Mac/Oracle deployment that moved Songi Apify/Gemini keys to per-user encrypted web storage.

Important product decision:
- Songi is `web-first`.
- Do not make Songi require the local agent.
- Blog Team/Naver browser automation still needs the local agent.
- Naver password/cookies/browser session stay local-only.
- Provider API keys/tokens may be managed in the web `AI/API 연결` panel.

What changed on Mac/Oracle:
- New web APIs:
  - `GET /api/user/secrets`
  - `PUT /api/user/secrets/:provider`
  - `DELETE /api/user/secrets/:provider`
- Providers:
  - `gemini`
  - `openai`
  - `claude`
  - `apify`
- Server uses user web-stored Apify/Gemini first for Songi, then global server fallback.
- Settings tab now has `AI/API 연결`.

Windows tasks:
1. Open `https://api.aimax.ai.kr/app` on Windows and confirm the Settings tab shows `AI/API 연결`.
2. Confirm Songi no longer tells users to fix Apify through the local agent path.
3. Review Windows local settings UI wording:
   - Naver ID/password should remain local.
   - API key fields, if still present, must not imply Songi Apify will work from local-only storage.
   - Keep API key fields if Blog Team local execution still depends on them, but label them clearly as local/legacy or Blog Team local use.
4. Re-check the existing v1.0.15 download/local-settings hotfix is not broken.
5. Do not run paid Apify/Gemini/Claude/OpenAI calls.
6. Do not run real Naver save/publish tests.

About automatic migration:
- Do not implement an ad-hoc migration command yet.
- Return a proposal if needed.
- The future migration must be explicit user opt-in and upload only provider API keys:
  - gemini_api_key
  - openai_api_key
  - claude_api_key
  - apify_api_token
- Never migrate Naver password, cookies, browser profile, or sessions.
- Never log raw key values.

Return files to the shared folder:
- `WINDOWS_COMPLETION_20260522_web_secret_songi_followup.md`
- Any screenshots with secrets hidden, if useful.
- Any patch or installer artifact only if you actually changed Windows source.

Completion report must include:
- Windows source/install version checked
- Web `AI/API 연결` result
- Songi Apify wording result
- Local settings wording result
- v1.0.15 download/settings regression result
- Paid API/Naver tests were not run
- Remaining blockers or Mac/server contract requests

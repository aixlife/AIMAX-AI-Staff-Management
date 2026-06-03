# AIMAX Project Rules

## Shared-Bridge Handoff

- When the user says something like "put this in the folder I share with the MacBook AI developer", "share this with the Mac AI developer", "drop this in the shared folder", or asks for a handoff to the Mac/Windows AI developer, use the Syncthing shared bridge by default.
- Default shared handoff root on Windows: `C:\Users\likim\Documents\shared-bridge`
- For AIMAX / NaverBlogAuto Windows handoffs, use: `C:\Users\likim\Documents\shared-bridge\20_Deploy-To-Windows`
- Create or place the requested Markdown/package/status file in the appropriate dated/topic folder under the shared bridge.
- Use clear filenames such as `WINDOWS_AI_STATUS_YYYYMMDD_<topic>.md`, `WINDOWS_AI_QUESTION_YYYYMMDD_<topic>.md`, or `WINDOWS_AI_DEVELOPER_MESSAGE_YYYYMMDD_<topic>.md` when relevant.
- After writing, tell the user the exact Windows path and also the relative shared-bridge path so the MacBook AI developer can find it quickly.
- Treat the newest shared-bridge Markdown files as cross-developer source of truth before starting, resuming, or finalizing related work.
- Do not put secrets in shared files: no API keys, passwords, Naver cookies, raw tokens, or unredacted Selenium traces.

## Paid Live Smoke Tests

- Default verification remains mock/stub/dry-run.
- When fixing AI generation bugs, a live paid smoke test is allowed only when it materially verifies the fix and can be kept tiny.
- Keep live smoke tests minimal:
  - Text generation: one test keyword, shortest practical prompt/output, no immediate Naver publish.
  - Writing-flow live smoke tests must use draft save and scheduled-save paths only. When a real Naver account is involved, use clearly marked test content, set any schedule far enough in the future to avoid accidental publication, record it in the evidence, and cancel/delete it when cleanup is in scope.
  - Image generation: only when the fix touches image generation, one image, cheapest practical model/resolution.
  - No bulk generation, production scheduling, unrelated account actions, immediate public posting, or engagement automation.
- Use the cheapest configured Gemini smoke model by default for general live checks. Prefer `LIVE_SMOKE_TEXT_MODEL` and `LIVE_SMOKE_IMAGE_MODEL` settings when present; otherwise choose the lowest-cost current Gemini model available in the project configuration.
- Provider-specific bugs must be tested with mock/stub payload checks first. Only use a live call to OpenAI/Claude/etc. when the bug cannot be validated through Gemini or mocks.
- Record model, provider, request id when available, token/image usage, estimated cost, and whether publishing was skipped in the evidence/report.
- Never place `.env`, API keys, Naver credentials, cookies, sessions, auth headers, or private settings in Syncthing/shared outputs.

## Windows Codex Session Memory

- When the user says `작업끝`, `오늘 작업 끝`, `세션 마무리`, `정리하고 끝내자`, `마무리 저장`, or `저장하고 종료`, save a full local session summary before finishing.
- Use the Windows Obsidian vault when available:
  - Sessions: `C:\Users\likim\Documents\creator-os-vault\sessions\AIMAX-AI-Staff-Management\`
  - Project memory: `C:\Users\likim\Documents\creator-os-vault\projects\AIMAX-AI-Staff-Management.md`
  - Daily notes: `C:\Users\likim\Documents\creator-os-vault\daily\`
  - Durable decisions: `C:\Users\likim\Documents\creator-os-vault\decisions\`
  - Reusable insights: `C:\Users\likim\Documents\creator-os-vault\insights\`
- If the vault is unavailable, use `C:\Users\likim\Documents\Codex-Session-Logs\AIMAX-AI-Staff-Management\` and create `sessions`, `projects`, `daily`, `decisions`, `insights`, and `concepts` under it.
- Session summaries must include these sections: `Summary`, `Decisions`, `Insights`, `Changes`, `Verification`, `Open Issues`, `Next Actions`, and `Connected Context`.
- Mark durable decisions with `#decision` and reusable insights with `#insight`; keep one-off logs in the session file and only promote stable decisions/insights to project memory.
- On the next broad AIMAX project session, read the project memory file and the latest 1-2 relevant session logs before making assumptions.
- Never save secrets, tokens, passwords, `.env` contents, browser profiles, signed URLs, paid-provider credentials, cookies, or raw private auth traces in session memory or shared summaries.

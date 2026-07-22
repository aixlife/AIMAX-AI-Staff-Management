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

## Semi-Automatic Error Automation

- AIMAX 오류 보고 자동화의 운영 원칙은 `오류 보고 접수 -> Codex가 원인 확인/코드 수정/검증 준비 -> 배포 전 사용자 승인 요청 -> "배포하자" 승인 후 배포 -> 완료 보고` 순서다.
- Do not deploy report-driven fixes automatically. Prepare the patch, run safe verification, summarize expected impact, and ask the user before production deployment or installer/version rollout.
- `aimax-report-watchdog.timer` is only the detector/alerter. `aimax-error-repair-agent.timer` is the repair handoff: it should launch a Codex repair pass when watchdog output contains stale reports or open tickets, complete code changes when feasible, run verification, and notify the user before deployment.
- `AIMAX-AUTO-*` tickets are operational triage records, not proof that a code fix or deployment has completed. Treat each open ticket as a work queue item that still needs inspection, patching, verification, and owner approval before release.
- If a report includes strong user language such as "한 번도 발행 안 됨", "단 한번도 발행이 된 적 없음", or equivalent, raise priority and do not close it as a simple transient provider issue without checking related job/log evidence.
- Error reports must retain enough sanitized job context for triage. When changing report payloads or summaries, verify that recent job id/kind/worker/status/stage survives into admin summaries and automation tickets.

## GitHub Push Fallback

- For AIMAX repos, local `git push` may fail because remotes are HTTPS and no interactive GitHub credential is available in this environment.
- Do not repeatedly try local `git push` against an HTTPS GitHub remote from this environment. Treat one credential failure as enough signal to switch methods.
- Before any remote sync, check `git remote -v`, `git ls-remote`, and available GitHub connector state.
- If local push fails with `could not read Username for 'https://github.com': No such device or address`, use the GitHub connector workflow instead of repeatedly retrying local push:
  - create/update the target branch through the connector when possible;
  - update the changed text files through the connector contents API;
  - verify remote branch/file contents after writing.
- If a previous session already succeeded through GitHub connector/API updates, prefer that known-good path first for GitHub sync unless the local remote has been changed to a verified non-interactive credentialed remote.
- Record in the final/Telegram report whether remote GitHub sync was done by local git or by connector fallback.

## Employee Launch Checklist

- For any new AI employee or employee-facing workflow, read `docs/runbooks/aimax-employee-release.md` and follow the sequence before final reporting.
- Before adding or changing an AI employee, decide whether the employee should be `web-first`, `local-agent-required`, or `hybrid`; explain that decision in recommendations and handoffs.
- Default to `web-first` when the employee's core job can run safely from the server/web app. Require the local agent only for OS/browser automation, local files, local-only secrets, or platform capabilities that cannot safely run on the server.
- Do not make a new employee depend on the local agent merely because existing Blog Team flows do; Blog Team needs the agent for Naver browser automation, but research/analysis employees may not.
- At employee intake, explicitly check display assets such as profile image/name/role. If an image is not provided yet, use a placeholder only with a visible TODO in the handoff/final summary and replace it when the user provides the asset.
- For free/public employees, use catalog-level public access so existing and new accounts can use them by default; do not rely on per-user bulk grants for free public access. Verify the admin catalog and new-account behavior.
- For web-first employees, prefer web-entered per-user provider secrets stored server-side with encryption, status-only API responses, delete/replace controls, and strict redaction. Do not require local-agent secrets for web-first work.
- Keep Naver browser automation credentials/session local-agent-only unless the user explicitly approves a different security model; do not store Naver passwords/cookies on the server by default.
- If local-only API keys are chosen for a future privacy mode, make the UX explicit: users should understand that keeping keys on their PC requires the local agent for those paid-provider actions.
- Always separate Mac/server work from Windows/local-agent work in plans, handoffs, and final summaries, and call out whether behavior is cross-platform or platform-specific.
- User-facing changes must be tested by the AI agents directly, not delegated back to the user: Mac-side Codex/Claude/Antigravity should run their own available smokes or UI checks, and Windows Codex should run the Windows environment checks through the shared-bridge handoff.
- Whenever a new AI employee or employee-facing workflow is added, verify that failures can be reported through the existing web 오류 보고 flow.
- User-visible worker failures should expose enough sanitized context for support: employee name, task/workflow, failed stage, visible error code/message, source URL or job id when relevant, and environment diagnostics from `reportEnvironmentPayload()`.
- Do not expose API keys, tokens, passwords, signed URLs, or raw paid-provider secrets in error reports.
- For paid or credit-based employee workflows, keep an explicit cost confirmation before execution and provide a retry/report path after failure.
- Later phase: add a sidebar/dashboard monthly cost panel that aggregates estimated/actual API spend by employee and provider.

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

## Backlog: 예리(블로그 직원) 블로그 리서치 통합 (2026-07-10)
- 예리에게 사용자 본인 블로그 원문 수집·문체 반영 기능을 넣는 작업이 대기 중이다. 스펙: `claudedocs/yeri-naver-blog-research-integration-2026-07-10.md`.
- 이 프로젝트에서 블로그 직원/예리 작업이 시작되면 이 스펙을 먼저 제안하고, Employee Launch Checklist(web-first 판단 포함)를 함께 적용한다.

## Backlog: 세무 직원(세금계산서 발행) 추가 (2026-07-10)
- 팝빌 기반 세금계산서 발행 AI 직원 추가가 대기 중이다. 스펙: `claudedocs/tax-employee-popbill-integration-2026-07-10.md`. 첫 사용자는 윤대표.
- "세무 직원", "세금계산서 직원" 언급 시 이 스펙을 먼저 제안한다.

## Model Freshness Check
- 트리거: 이 저장소에서 "모델 업데이트 확인", "최신 모델 확인해줘", "모델 최신인지 봐줘" 등
  → 3사(Gemini/OpenAI/Anthropic) 최신 모델·가격을 무료 조회로 점검하고 AIMAX 하드코딩과의 델타를 보고.
- 무료 점검 절차: (1) provider ListModels — Gemini `GET /v1beta/models`, OpenAI `GET /v1/models`,
  Anthropic `GET /v1/models` (회사 키는 Keychain, 값 노출 금지) (2) 공식 가격 문서 확인
  (3) AIMAX 현행 대조 — server.js `YERI_*/SONGI_*/YUNMI_*` 상수·`YERI_GEMINI_MODEL_CHAIN`,
  static/app.html `AI_MODEL_OPTIONS`·`YUNMI_AI_MODEL_OPTIONS`·`IMAGE_MODEL_OPTIONS`·`AI_MODEL_PRICES`,
  app.py `_AI_MODELS`·`_AI_TEXT_PRICE_USD_PER_1M` (4) 은퇴·과부하·신규·가격변동 델타를 표로 보고.
- 유료 실측(속도·비용·품질 생성 테스트)은 무료 점검에 넣지 않는다. 교체가 필요해 보이면
  예상 비용을 산정해 CEO 승인 후 실측한다(무료 티어 없는 gpt/claude는 매 호출 과금).
- 기본값은 실측으로 검증된 현행 세대만. 특정 모델명 하드코딩 대신 server.js의 가용 모델
  조회+폴백 체인 구조를 우선한다(2026-07-22 Gemini 신규키 404 사고 교훈).

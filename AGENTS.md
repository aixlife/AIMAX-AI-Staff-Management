# AIMAX Project Rules

- AIMAX 새 세션 시작 시 기본은 fast boot: `memory/MEMORY.md`, Obsidian 프로젝트 MOC, 최신 관련 세션 1개, 오늘자 handoff/deploy만 읽고 바로 현재 보드와 다음 작업을 제시한다. 깊은 복구는 충돌/배포/Windows 연계가 있을 때만 확장한다.
- **[배포 최우선 규칙]**: 모든 작업 완료 및 개선 사항은 단순히 개발자의 맥 로컬에 보관하는 것에 그치지 않고, 반드시 실배포(Deploy)하여 실제 사용자가 즉시 사용할 수 있도록 배포 파이프라인을 최우선으로 진행해야 한다. 맥 로컬 저장은 부차적이며 실사용을 위한 배포가 핵심 목표이다.

## Songi PRD Source

- For 송이/자료조사원 work, use `/Users/aixlife/Downloads/local-ai-research-agent-prd.md` as the product 기준 문서 unless the user explicitly changes the spec.
- Keep 송이 aligned to the PRD flow: `프로젝트 생성/선택 → 링크 입력 → 분석 진행 상태 → 결과 카드/상세 → 메모/브리프 재활용 → 로컬 저장`.
- Do not add extra upfront inputs that make first use feel heavy unless the PRD or user specifically asks for them.

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

## Actual User Flow Testing

- For any user-facing web/app/runner change, do not mark the gate complete with API/smoke tests alone. Open the real web UI like a user, log in with the approved test account/session, click through the affected flow, and capture evidence such as screenshots, visible status text, version, and environment.
- Prefer deterministic Playwright/browser scripts for repeatable checks, then use agent-style browser exploration only as an extra human-like check when selectors or flows are uncertain.
- If the flow depends on the local runner, test with the installed app running, not only source mode or a bundled artifact. Mac and Windows installed-user flows must be verified separately.
- Record blockers from the user's perspective: visible loading loops, reconnect/update prompts, disabled buttons, wrong version recognition, missing error report details, and stale local state.

## Paid Actual Test Gate

- When a paid or credit-based flow is the real user value, define the minimum paid test before skipping it: provider/model, action, expected max cost, account, input size, output target, mutation limit, and retry/resume rule.
- Run paid tests only after no-cost gates pass and the user has explicitly approved that concrete paid scope. Default paid scope for AIMAX Blog Team is one short text, one image maximum, draft-save only, no publish/schedule, no customer credentials, no duplicate retry without checking the existing job/result first.
- Preserve paid test evidence without secrets: job/request id, status URL if safe, sanitized error/report payload, generated artifact location, and whether the content reached the intended editor/draft position.

## Pre-Deploy Real Test Gate

- Before any live deploy, Oracle version API change, or customer-facing installer rollout, run at least one real user-path test from the actual web UI with an installed runner on the target platform. Do not replace this with direct API calls, DOM patching, source-mode runs, or mock-only smokes.
- If the release changes a paid or credit-based user value path, the pre-deploy gate must include one bounded paid test under the approved scope, unless the real web UI cannot yet expose that path. In that case, stop before deploy and fix the user path first.
- The pre-deploy evidence must include screenshots or visible text, account, platform, installed version, selected options, cost cap, job/request id, final status, and explicit confirmation of no publish/schedule/customer credentials unless approved.

## Windows Handoff Protocol

- When Mac-side work creates a requirement that must be built, tested, or verified on Windows, prepare a Syncthing handoff before reporting completion.
- Use the shared folder: `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/<date-topic>/`.
- Put a Markdown handoff document in that folder with the exact Windows task, source/artifact names, validation steps, and return expectations.
- Also create a copy-paste prompt for the Windows AI developer in the same folder, named `WINDOWS_AI_COPYPASTE_PROMPT_YYYYMMDD_*.md`.
- The prompt must tell the Windows AI developer to read the latest handoff docs first, copy source out of Syncthing into a local Windows work folder, avoid building inside the shared folder, keep secrets/passphrases out of Syncthing, run verification, and return completion/blocker reports plus artifacts to the shared folder.
- Windows verification means Windows Codex directly runs the tests/smokes in the Windows environment and returns evidence; do not rely on the user manually checking unless the user explicitly says they did the smoke.
- If the Windows task needs current source, provide a sanitized source ZIP or explicit patch in the same handoff folder. Exclude `.env`, passphrases, decrypted secrets, `venv`, `build`, `dist`, caches, and private handoff files.
- In the final response to the user, include the Syncthing folder path and the copy-paste prompt text.

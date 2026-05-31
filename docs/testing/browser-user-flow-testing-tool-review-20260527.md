# Browser User-Flow Testing Tool Review - 2026-05-27

## Why This Exists

The AIMAX release process must test what a real user sees, not only API responses or headless smokes. The project rule now requires real web UI testing before completing any user-facing gate.

## Sources Checked

- `browser-use/browser-use`: open-source Python browser automation for AI agents; supports CLI actions, screenshots, real browser profiles, and optional cloud usage.
- `browserbase/stagehand`: AI browser automation framework that mixes natural language actions with code and supports `act()`, `agent()`, and `extract()`.
- `microsoft/playwright-mcp`: Playwright MCP server that lets LLMs interact with pages through accessibility snapshots.
- `vercel-labs/agent-browser`: fast browser automation CLI for AI agents using Chrome/Chromium and deterministic snapshot refs.

## AI Council Summary

Claude:

- Keep deterministic Playwright as the first lane.
- Use Playwright MCP first if adding agent-style browsing because it preserves existing Playwright investment.
- Keep agent tests separate from deterministic smoke tests because LLM-driven tests can be flaky.

Gemini:

- Use a hybrid approach: Playwright for core deterministic checks and an agent-style tool for exploratory user journeys.
- Stagehand or agent-browser can be tested through a small PoC.
- Watch cost, non-determinism, and integration complexity.

## AIMAX Decision

Adopt a two-lane test policy:

1. Deterministic lane: Playwright scripts stay the release blocker for stable checks.
2. Human-like lane: add one small PoC with Playwright MCP or agent-browser before relying on AI browser agents for release evidence.

Do not use AI browser-agent results as the only proof of correctness. They are useful for "what would a user notice?" checks, but release gates still need stable assertions.

## Pre-Deploy Rule

Before a live deploy, Oracle version API change, or customer-facing installer rollout, AIMAX must run one real user-path test from the actual web UI with an installed runner on the target platform. API-only, source-mode, DOM-patched, or mock-only tests do not satisfy this gate.

If the release touches the paid Blog Team value path, the pre-deploy gate must include one bounded paid draft-save test after no-cost gates pass and after the user approves the concrete paid scope. If the real web UI cannot expose the required paid test path, the release should stop before deploy and fix that UI path first.

## Paid Test Policy

Paid tests should not be skipped when the paid path is the actual product value. Before any paid run, write the concrete scope:

- provider/model
- action
- expected max cost
- test account
- input size
- output target
- mutation limit
- retry/resume rule

Default AIMAX Blog Team paid scope:

- one short text
- one image maximum
- draft-save only
- no publish/schedule
- no customer credentials
- no duplicate paid retry before checking existing job/result

## Next Practical Step

For the next AIMAX phase, add one repeatable user-flow script per platform:

- Mac installed app + real web UI + test account + screenshot evidence.
- Windows installed app + real web UI + test account + screenshot evidence.

Then run the minimal paid draft-save test only after no-cost gates pass and the user approves the concrete paid scope for that run.

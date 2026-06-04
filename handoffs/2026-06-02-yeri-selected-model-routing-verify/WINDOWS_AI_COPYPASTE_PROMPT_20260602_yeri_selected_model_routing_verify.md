# Windows AI Copy-Paste Prompt - Yeri selected model routing verification

AIMAX Windows verification task.

Read the latest handoff docs in:
`C:\Users\aixlife\Documents\Shared-Bridge\20_Deploy-To-Windows\2026-06-02-yeri-selected-model-routing-verify\`

Do not edit production code unless the deployed hotfix is missing. Do not build or run inside the shared folder. If source is needed, copy the repo to a local Windows work folder first. Keep secrets, passphrases, API keys, cookies, and private account data out of Syncthing.

Goal:
Verify that 예리 블로그 글쓰기 uses the AI model selected by the user, instead of always falling back to Gemini.

Production hotfix already deployed by Mac/Oracle:
- server.js SHA256: `665096ed944a94ebdcff2e70fbe9fed850cc6b9a93386eadab0afca7d5ff5363`
- app.html SHA256: `813cbc347515aa1403e6aaf17d75d8e85e03fd7d1ac2bcd1a753355e26aaaa94`

Verify:
1. Open production AIMAX web app on Windows.
2. Confirm Yeri server generation config includes supported providers: `gemini`, `openai`, `claude`.
3. Confirm the 예리 AI model selector offers Gemini, GPT/OpenAI, and Claude choices.
4. Select Claude and OpenAI/GPT in the UI and verify no Gemini-only fallback/cost/confirmation copy appears for those selections.
5. If a server-generation confirmation appears, it must name the selected provider/model.
6. If the current source checkout is available, run no-paid smoke:
   `node scripts/smoke_yeri_selected_model_routing.mjs`
   Expected: `YERI_SELECTED_MODEL_ROUTING_SMOKE_OK`
7. Do not run real paid AI generation, Apify, Naver publish, or Naver schedule actions unless Minsoo separately approves provider/model, account, action, input size, max cost, mutation limit, and retry/resume rule.

Return a Markdown completion or blocker report to the same Syncthing folder with Windows/browser info, masked account identifier, visible UI/API evidence, no-paid smoke result if run, screenshots if available, and confirmation that no paid action was run.

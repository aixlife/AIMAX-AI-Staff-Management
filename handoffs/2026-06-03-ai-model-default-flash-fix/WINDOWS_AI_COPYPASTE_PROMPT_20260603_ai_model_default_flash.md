You are the Windows AI developer for AIMAX. Apply and verify the Mac-side AI-generation fix: the default text model was `gemini-3.1-pro-preview` (blocked on free Gemini tier → mass "AI 글 생성 실패"), now reverted to `gemini-2.5-flash`, with a one-time migration for users who already have pro-preview saved, and a free pre-generation key validity check.

First read (copy out of Syncthing into a local Windows work folder before doing anything):

1. `20_Deploy-To-Windows/2026-06-03-ai-model-default-flash-fix/WINDOWS_HANDOFF_20260603_ai_model_default_flash.md`

Important operating rules:

- Copy needed files out of Syncthing into a local work folder. Do not build or run inside the shared folder.
- Keep secrets/keys/passwords/cookies/tokens out of Syncthing.
- Do not run paid AI / Apify / YouTube Data API / duplicate paid retries.
- Real testing required — NOT smoke/mock. Reproduce the actual user flow.

What changed (in the synced Mac source):
- `app.py` + `content/ai_text.py` (these are bundled into the .exe → rebuild needed): default model → `gemini-2.5-flash`; legacy `gemini-2.5-pro` alias no longer force-upgrades to pro-preview; one-time `migrate_forced_pro_preview_default()` reverts stored pro-preview → flash on `load_settings` (explicit re-selection of pro-preview is preserved via a migration flag); `precheck_gemini_key()` does a free ListModels check before generation to surface expired/invalid keys early. `gemini-3.1-pro-preview` is KEPT as a paid/advanced option.
- `oracle/aimax-reports-api/static/app.html` (Oracle web deploy, NOT in the .exe): error branches now match the Korean classified reasons so auth vs quota are shown distinctly. Backend unchanged.

Tasks:
1. Rebuild the .exe from the synced source via `AIMAX.spec`.
2. Real verification (NOT smoke):
   a. Default: fresh profile (no saved settings) → model defaults to "Gemini 2.5 Flash ★기본".
   b. Migration (real data): put `"ai_model": "gemini-3.1-pro-preview"` in settings.json, launch → confirm the file becomes `"gemini-2.5-flash"` and gains `forced_pro_preview_default_migrated: true`.
   c. Explicit re-selection persists: after migration, pick "Gemini 3.1 Pro Preview (유료/고급)" and save → relaunch → it stays pro-preview (does NOT revert to flash again).
   d. Key precheck (expired key, no charge): with an expired Gemini key, start generation → a clear "키 인증 실패/키를 확인" reason appears BEFORE the generation attempt (free ListModels, no cost).
   e. Generation success (NEEDS a valid key — current keys are expired = blocker): if a valid key is available, run one real flash generation and confirm success. If not, state "generation success not executed (no valid key)".
3. (Oracle web, separate) After app.html deploy, confirm a failed generation shows "AI API 키 확인 필요" vs "AI API 사용량 또는 쿼터 초과" distinctly.

Note: the synced source also contains broad unrelated Mac WIP (UI redesign etc.) — the build reflects that whole state, not only this fix. Flag anything unexpected.

Return a Markdown report in:
`20_Deploy-To-Windows/2026-06-03-ai-model-default-flash-fix/WINDOWS_RESULT_20260603_ai_model_default_flash.md`
Include: overall PASS/BLOCKED, Windows/app version, rebuild result, evidence for 2a–2e (especially the settings.json before/after for the migration), generation-success status (key available or not), and an explicit no-paid/no-secrets statement.

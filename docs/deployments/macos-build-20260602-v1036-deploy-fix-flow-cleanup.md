# macOS build ready - 2026-06-02 v1.0.36 deploy fix / flow cleanup

## Scope

Applied the 2026-06-02 Mac handoff desktop source updates and added Oracle-side Yeri server generation hardening in the local repository. Built and installed a new macOS bundle from the updated source.

After owner approval, deployed the targeted Oracle Yeri server-generation fix (`server.js` + `static/app.html`) and ran one bounded real-use paid test through the production server artifact path with the installed Mac runner. The test was draft-save only with no publish, no schedule, and no customer credentials.

## Key changes

- Yeri server generation now uses provider retry/error classification for auth, quota, rate limit, overload/5xx/timeout, and generic provider failures.
- Next server generation failures persist sanitized visible error details instead of only `server_generation_failed`.
- Yeri text model defaults were updated to `gemini-3.1-pro-preview` and `claude-sonnet-4-6`; legacy Gemini aliases normalize to the preview model.
- Web UI failure explanation now surfaces `visible_error`/`user_message` for content generation failures.
- Desktop source updates from the handoff were merged: title input fallback, draft/schedule robustness, macOS/Windows clipboard image branching, and build preflight restoration.
- Mac real-use test found `image_count=0` was being treated as false and falling back to 3 images in local runner handoff paths; `app.py` now preserves explicit zero via `_payload_image_count()`.
- `paths.py` keeps `APP_NAME = "AIMAX"`; `NaverBlogAuto` remains only as legacy fallback where intentional.
- OpenAI local fallback `reasoning.effort` remains `low` for AIMAX compatibility.

## Oracle log diagnosis

Checked Oracle job data for recent `yeri_write` failures around the customer keyword `암주요치료`.

- `8a4d61b5-d5c1-442b-bd2b-37560f472004` - 2026-06-01T13:22:45Z - model `claude`
- `7eb6a289-a1e3-4771-96c0-b21dccdafc5e` - 2026-06-02T00:39:49Z - model `claude`
- `5ba04410-a663-4701-aa8b-9cff00316f57` - 2026-06-02T02:32:39Z - model `claude`

The old server stored only generic failure text (`글 생성 실패: 암주요치료`) and did not preserve provider HTTP status/body classification. Exact 429/401/quota confirmation is therefore not recoverable for those historical jobs. The new local server patch is intended to preserve that detail for the next failure.

## Validation

- `python -m py_compile app.py build.py content/ai_text.py paths.py posting/editor.py posting/publisher.py scripts/verify_schedule_publish_smoke.py`: pass
- `venv/bin/python -m py_compile ...`: pass
- `venv/bin/python -c "import app"`: pass
- `venv/bin/python -c "import ttkbootstrap, selenium, PyInstaller, yt_dlp"`: pass
- `python scripts/preflight_split_drift.py`: pass
- `git diff --check` on relevant files: pass
- `node --check oracle/aimax-reports-api/server.js`: pass
- inline script parse for `oracle/aimax-reports-api/static/app.html` and `static/admin.html`: pass
- no-paid Yeri server generation mock/routing/paid-guard/real-test-guard smokes: pass
- `scripts/deploy_oracle.sh web --dry-run`: pass
- targeted Oracle deploy syntax checks and service restart: pass
- public health after deploy: pass
- installed Mac runner real-use path: server-generated Claude artifact -> Naver editor title/body entry -> draft-save confirmation: pass

## macOS build artifact

- Build command: `venv/bin/python build.py`
- Bundle: `dist/AIMAX.app`
- Release payload: `dist/AIMAX-macos`
- DMG: `dist/AIMAX-macos.dmg`
- Bundle version: `1.0.36`
- Diagnostics probe: `/private/tmp/aimax_20260602_diag_probe.json`
- Diagnostics app version: `v1.0.36`
- `ai_text_import_smoke.ok`: `true`
- `excel_loader_import_smoke.ok`: `true`
- `hdiutil verify dist/AIMAX-macos.dmg`: valid
- `codesign --verify --deep --strict --verbose=2 dist/AIMAX.app`: valid
- DMG size: `49M`
- DMG SHA256 after final rebuild: `8a8e930b8aff88012452fecf335b93b343d86e098b580822ba372df924679724`
- Installed app executable SHA256: `393de2332c5994d39383edae58e0e2c2df4ab4a8f26381d4c3501343a47244f9`

## Oracle targeted deploy

- Remote backup: `/home/ubuntu/aimax-backups/20260602-165359-yeri-server-generation-targeted`
- Deployed files only: `oracle/aimax-reports-api/server.js`, `oracle/aimax-reports-api/static/app.html`
- Uploaded SHA256:
  - `server.js`: `908c5f1692775cac47b3854ed55826bc27b49bc5a89ba3ca5ca7d1911ffea0b9`
  - `app.html`: `af206e3b6b8f191cd9a4a4c103f9f43fe028745a7ead89c49c64cfd7d54d2ec1`
- Service health: `ok`
- Temporary `AIMAX_YERI_SERVER_GENERATION_REAL_TEST_ONLY=1` was used only for the approved real-use test, then restored to `0`.

## Real-use paid test evidence

- Account: `demo@aimax.ai.kr`
- Platform: macOS installed runner, `/Applications/AIMAX.app`, version `v1.0.36`
- Job ID / artifact ID: `f75691ee-bcf3-44cd-8b7b-85651366beb3`
- Provider/model: Claude, artifact `text_model` = `claude-sonnet-4-6`
- Scope: one short text, `word_count=300`, `image_count=0`, draft-save only
- Usage: 419 input tokens, 505 output tokens, 924 total tokens
- Estimated cost recorded by server: KRW 14
- Images: attempted `0`, generated `0`, inserted `0`
- Final job status: `done`
- Generated markdown backup after runner success: `/Users/aixlife/Library/Application Support/AIMAX/generated/20260602-171100_AIMAX v1036 업데이트 안내  Claude 서버 생성 기능 추가.md`
- Naver result: title/body inserted and temporary draft saved; no publish/schedule/customer credentials used.

## Windows handoff

Prepared Syncthing handoff for Windows-side verification:

`/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-06-02-deploy-fix-flow-cleanup-recheck/`

Source ZIP SHA256:

`fdaf6bf84a975cc95def219b1e38a4f86327b8a6d50c26dd346c9bb07c315a56`

## Next gate

Before a broad installer/version API rollout:

1. Receive Windows-side validation result for the updated handoff, especially the `image_count=0` regression.
2. Decide whether to publish the macOS DMG alone or wait for the Windows build as the coordinated cross-platform release.
3. If publishing installers, upload the final artifacts and update the version API/download metadata after the platform-specific checks are clean.

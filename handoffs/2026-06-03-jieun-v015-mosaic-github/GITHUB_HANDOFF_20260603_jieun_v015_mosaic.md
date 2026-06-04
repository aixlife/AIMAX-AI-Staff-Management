# GitHub Handoff - 지은 v0.1.5 캡처 이미지 모자이크

## Primary GitHub Issue

- Repo: `aixlife/aimax-viseo`
- Issue: https://github.com/aixlife/aimax-viseo/issues/1
- Target version: `v0.1.5`
- Employee: `지은`
- Role: `AI 오피스 지원`
- Platform: Windows only

## Goal

Add a post-capture mosaic/redaction feature to the Jieun desktop app. After a user captures an image, they should be able to select one or more rectangular regions and apply mosaic processing before saving the edited image.

## Expected User Flow

1. User captures the screen with the existing capture feature.
2. App opens a preview or edit surface for the captured image.
3. User selects `모자이크`.
4. User drags rectangular regions over sensitive parts of the image.
5. App applies pixel mosaic or strong blur to selected regions.
6. User can repeat the action for multiple regions.
7. User saves an edited copy while the original capture is preserved.

## Acceptance Criteria

- Existing capture flow still works.
- Mosaic tool is available after capture.
- At least one dragged rectangle can be mosaicked.
- Multiple regions can be mosaicked in one image.
- Edited image is saved with redacted regions.
- Original image is not overwritten by default.
- Windows installed-app flow is verified: capture -> mosaic -> save.
- New Setup EXE and portable EXE are returned for `v0.1.5`.

## Artifact Return Requirements

Do not commit EXE files into normal source git history. Return build outputs through GitHub Release assets or GitHub Actions artifacts.

Required return data:

- PR URL
- Build or release URL
- Setup EXE filename, byte size, SHA256
- Portable EXE filename, byte size, SHA256
- Windows actual test evidence such as screenshots
- Windows version and app execution environment
- Any blockers or limitations

## AIMAX Oracle Follow-Up

After Windows artifacts are ready, Mac/Oracle side should:

1. Upload `AIMAX-Office-Manager-Setup-0.1.5.exe` to Oracle `/downloads/`.
2. Upload the portable EXE if returned.
3. Update Jieun worker catalog version/download URLs in:
   - `oracle/aimax-reports-api/server.js`
   - `oracle/aimax-reports-api/static/app.html`
   - `scripts/smoke_worker_catalog_contract.mjs`
   - `scripts/deploy_oracle.sh`
4. Run worker catalog and HTML parse checks.
5. Deploy to Oracle.
6. Verify `/api/workers`, app employee card, admin catalog, and public download URLs.

## Privacy/Safety

- Do not upload secrets, passwords, cookies, API keys, customer data, or private screenshots to GitHub.
- Use only dummy or public-safe sample images for PR evidence.
- Preserve originals by default because this is a privacy/redaction workflow.

# Windows Handoff - R3-F Release Rollout Readiness

Date: 2026-05-26 KST

## Purpose

Prepare the Windows side for the R3-F release rollout after real E2E passed on both Mac and Windows.

This is a packaging/release-readiness task, not another paid E2E task.

## Current Known Status

Mac:

- R3-F NID loop fix passed real E2E.
- Draft-save mode passed.
- Title/body input passed.
- Image generation/insertion passed.
- Mac needs a new release version, expected `v1.0.12`, because the fix was rebuilt under the already-used `v1.0.11`.

Windows:

- Real installed-runner E2E passed on `v1.0.21`.
- Successful job: `fc132ee6-5863-4499-817a-e6e4d631e106`
- Final status: `done`
- Mode: `save`
- Image generated/inserted: `1`
- Publish/schedule: not executed
- Known final installer from previous handoff:
  `aimax-bundle-windows-v1.0.21-r3f-nid-login-fix.exe`
- Known upload installer SHA256:
  `9886C05275355A9548CA7DCA36D2804C096A734BEC7336DC05BFB3DC4084CB2F`

## Windows Task

1. Work in a local Windows folder, not inside Syncthing/shared folder.
2. Confirm the `v1.0.21` source/build/install candidate is the final Windows release candidate for R3-F.
3. Confirm the installer intended for upload is the same artifact that passed installed-runner E2E.
4. Copy or produce a final official upload-named installer into this shared folder:

```text
aimax-bundle-windows.exe
```

5. Return a result report and sanitized diagnostics:

```text
WINDOWS_RESULT_20260526_r3f_release_rollout.md
aimax_r3f_v121_release_ready_diag.json
```

## Required Verification

The result report must include:

- verdict: `pass` or `blocked`
- release version: `v1.0.21`
- whether this is the same code path that passed the real E2E
- final installer file name and SHA256
- installed diagnostics result
- `system.app.version`
- `system.runtime.frozen`
- `ai_text_import_smoke.ok`
- `browser_version_detection.ok`
- no paid AI calls in this rollout-readiness task
- no Apify
- no Naver mutation
- no customer credentials

## Forbidden

- Do not run another paid AI test unless Minsu explicitly requests it.
- Do not create, claim, or execute new jobs for this release-readiness task.
- Do not call Apify.
- Do not publish/schedule any Naver post.
- Do not copy secrets, raw logs, browser profiles, cookies, tokens, or `.env` files into Syncthing.

## Return Gate

After Windows returns the files above, Mac-side Codex will:

1. verify the returned report/diagnostics/checksum,
2. prepare Mac `v1.0.12`,
3. prepare the Oracle installer upload/version API gate,
4. ask or proceed according to the current user-approved deployment scope.

## Known Follow-up After Rollout

R3-G should add defense for empty image prompts:

- if generated markdown contains an empty image prompt,
  - regenerate a prompt,
  - use a safe default prompt,
  - or skip image insertion with a clear stage result.

# Copy-paste prompt for Windows AI developer

You are the Windows AI developer for AIMAX. Please read this handoff first:

`/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-06-02-deploy-fix-flow-cleanup-recheck/WINDOWS_HANDOFF_20260602_deploy_fix_flow_cleanup_recheck.md`

Then do the Windows-side validation.

Important rules:

- Copy `source/changed-files/` out of Syncthing into a local Windows AIMAX work folder before editing, testing, or building.
- Do not build inside the shared Syncthing folder.
- Keep secrets/passphrases/API keys/cookies/browser profiles out of Syncthing.
- Do not run paid AI generation, image generation, Naver publish, Naver schedule, or customer credential tests unless the owner gives a separate concrete approval.
- If an actual Naver editor smoke is approved later, draft-save only. No publish/schedule.

Validation targets:

1. Apply/copy the changed source files into the Windows local work folder.
2. Run:

```powershell
python -m py_compile app.py build.py content\ai_text.py paths.py posting\editor.py posting\publisher.py scripts\verify_schedule_publish_smoke.py
python scripts\preflight_split_drift.py
```

Do not run `python scripts\verify_schedule_publish_smoke.py` live unless the owner gives a separate explicit approval for a draft-save-only Naver smoke.

3. Confirm the `image_count=0` regression from the Mac paid test is fixed on Windows too: when a server-generated article artifact has zero requested images, the Windows runner must not fall back to generating 3 images.
4. If build dependencies are available, run:

```powershell
python build.py
```

5. If a Windows runner artifact is produced, record app version, SHA256, and no-paid diagnostics/heartbeat evidence.
6. Return `WINDOWS_RESULT_20260602_deploy_fix_flow_cleanup_recheck.md` to the same Syncthing folder with commands, outputs summary, pass/fail, blockers, artifact paths/hashes, version value used on Windows, and explicit confirmation that no paid API, publish, schedule, or customer credentials were used.

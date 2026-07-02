# Windows Handoff - R3-F NID Login Redirect Fix

Date: 2026-05-25 KST

## Purpose

Apply and verify the same Naver NID redirect-loop fix on the Windows local runner.

Mac paid E2E passed after this fix:

- existing job artifact reused
- NID stale session detected correctly
- fresh login fallback executed
- Smart Editor opened
- title/body inserted
- OpenAI image 1 generated/inserted
- draft saved
- no publish/schedule

## Bug

`sync_pc_blog_login()` previously checked:

```python
if "blog.naver.com" in current:
```

This misread the NID login URL as a successful blog redirect:

```text
https://nid.naver.com/nidlogin.login?svctype=262144&url=https://blog.naver.com
```

Result: stale Naver sessions were reported as success, so `login()` never fell back to fresh login and the runner looped on NID.

## Source Files Included

Copy from this handoff folder into a local Windows working copy:

```text
source-files/browser/session_manager.py
source-files/auth/naver_login.py
```

Do not build inside Syncthing/shared folder.

## Required Changes

1. `browser/session_manager.py`
   - Use `urlparse(current).hostname` for blog-domain success detection.
   - Use hostname-based NID detection too.
   - NID host must return `False` so `login()` can run fresh login fallback.

2. `auth/naver_login.py`
   - In `login_on_current_nid_page()`, after `sync_pc_blog_login()` returns true, re-check current URL.
   - If still `nidlogin.login`, log warning and do not return success.

## Windows Validation

Run in a local Windows work folder:

```powershell
python -m py_compile browser\session_manager.py auth\naver_login.py
```

Then run at least one no-paid validation:

- Construct or inspect the NID URL case:
  `https://nid.naver.com/nidlogin.login?svctype=262144&url=https://blog.naver.com`
- Verify hostname parses as `nid.naver.com`
- Verify this path would return `False`, not success

If building a Windows installer for rollout:

- Rebuild the installed runner candidate.
- Prefer bumping Windows package/update version to the next Windows version if users must receive this fix through update.
- Run `--diagnostics-probe` on the built/installed runner.
- Confirm no job is created/claimed/executed during the no-paid checks.

## Forbidden

- Do not run paid AI generation.
- Do not run Apify.
- Do not publish or schedule any Naver post.
- Do not use customer credentials.
- Do not put secrets, tokens, cookies, or passwords in Syncthing.

## Return Expected

Return to this same shared folder:

```text
WINDOWS_RESULT_20260525_r3f_nid_login_fix.md
aimax_r3f_windows_nid_login_fix_diag.json
```

The result should state:

- files patched or already equivalent
- syntax check result
- no-paid NID URL guard result
- build/version decision
- diagnostics probe result if built
- whether a real Windows draft-save E2E is still needed

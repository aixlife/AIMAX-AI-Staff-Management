# macOS Build 20260525 v1.0.11 R3-F NID Login Fix

Date: 2026-05-25 KST

## Scope

Rebuilt and reinstalled the macOS AIMAX local runner after the NID redirect loop fix for Yeri R3-F.

## Fix

- `browser/session_manager.py`
  - `sync_pc_blog_login()` now checks `urlparse(current).hostname` instead of substring matching.
  - Prevents false success on `nid.naver.com/nidlogin.login?...url=https://blog.naver.com`.
  - NID host detection is also hostname-based.
- `auth/naver_login.py`
  - Defensive guard keeps `login_on_current_nid_page()` from returning success if the URL is still `nidlogin.login`.

## Build / Install

- Build command: `venv/bin/python build.py`
- Built app: `dist/AIMAX.app`
- Built DMG: `dist/AIMAX-macos.dmg`
- Installed app: `/Applications/AIMAX.app`
- Previous installed backup: `/Applications/AIMAX.app.v1.0.11.pre-r3f-nidfix-20260525-2358`

## Verification

- `python -m py_compile browser/session_manager.py auth/naver_login.py`: passed
- `dist/AIMAX.app --diagnostics-probe`: `version=v1.0.11`, frozen runtime
- `/Applications/AIMAX.app --diagnostics-probe`: `version=v1.0.11`, frozen runtime
- `codesign --verify --deep --strict dist/AIMAX.app`: passed
- `codesign --verify --deep --strict /Applications/AIMAX.app`: passed
- `hdiutil verify dist/AIMAX-macos.dmg`: passed

## Paid E2E Result

Existing job `d0abdaa5-0e13-41cf-a6b8-69ef613158dc` was retried with artifact reuse:

- `reused_artifact=true`
- final status: `done`
- mode: `save`
- title/body inserted
- OpenAI image generated/inserted: 1
- draft saved
- no publish/schedule
- estimated total cost: 63 KRW

Detailed result:

`docs/testing/aimax_r3f_yeri_minimal_paid_e2e_mac_20260525.md`

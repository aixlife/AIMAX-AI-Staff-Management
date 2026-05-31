Read first:

`WINDOWS_HANDOFF_20260521_v113_login_ime_guard.md`

Use the returned source files only as reference. Copy any needed source out of Syncthing into a local Windows work folder before building. Do not build inside the shared folder.

Goal:

Implement the Windows AIMAX Local Agent login IME guard matching macOS `v1.0.7`, then build/test/deploy as Windows `v1.0.13` if changes are required.
Also mirror macOS `v1.0.8` first-login heartbeat ordering: after successful web login, start polling/heartbeat before opening the local security settings dialog.

Must preserve:

- Windows `v1.0.12` login UX and safe-storage fixes
- previous editor/image-provider fixes
- no-paid/no-Naver-test policy

Required behavior:

- The web password field should clearly warn users to use English input mode.
- Login should be blocked before HTTP request if the password contains Hangul, leading/trailing spaces, or non-ASCII/non-visible characters.
- Rejected password input should clear the password field.
- Valid ASCII passwords should continue normally.
- First successful login should show connected/heartbeat in the web dashboard even while the local security settings dialog is open.

Do not send or inspect:

- customer data
- API keys
- cookies
- `.env`
- browser profiles
- setup links
- signed URLs
- raw private logs

Do not run:

- paid AI generation calls
- real Naver publish/save/draft tests

Return:

- `WINDOWS_COMPLETION_20260521_v113_login_ime_guard.md` or blocker report
- installer artifact and SHA256 if built
- verification summary
- final deployment status

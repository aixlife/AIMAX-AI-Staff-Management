AIMAX Windows verification task.

Read the latest handoff docs in:
`C:\Users\aixli\Documents\Shared-Bridge\20_Deploy-To-Windows\2026-06-02-nakyung-pencil-windows-download-verify\`

Do not build inside the Syncthing shared folder. Copy/clone source into a local Windows work folder first. Do not put secrets, passphrases, API keys, GitHub tokens, or private account data in Syncthing.

Task:
1. Verify `https://github.com/makefriendscoltd-design/pencil` on Windows.
2. Copy these files from the Syncthing folder to a local Windows work folder. Do not run or upload directly from Syncthing:
   - `Pencil-Setup-1.0.0.exe`
   - `Pencil-portable.exe`
3. Verify their SHA256 hashes:
   - setup SHA256 `6b974365a793826619933f1b0930ce0fbb5ad6bd278781325213afcd4187a4b0`
   - portable SHA256 `d9c31c8a71d88b293957413f71da3735fda8b0a52bfa3eb1eda69406c99f08af`
4. Check whether `https://github.com/makefriendscoltd-design/pencil/releases/tag/v1.0.0` has these Windows EXE assets:
   - `Pencil-Setup-1.0.0.exe`
   - `Pencil-portable.exe`
5. If release assets are missing and Windows-side GitHub permissions are available, create release `v1.0.0` and upload the two EXE assets under the user's approved scope. If permissions are not available, report the blocker.
6. After AIMAX web/staging is available, verify the `나경` staff card:
   - name `나경`
   - role `판서`
   - `Windows 전용`
   - direct-download employee, not a job composer flow
   - button `Setup exe 다운로드` downloads `Pencil-Setup-1.0.0.exe`
7. If admin is accessible, verify `AIMAX Admin > 직원 카탈로그` shows `나경` as:
   - `직접 다운로드`
   - `무료 공개`
   - `신규 계정 자동 제공`
   - `Windows 전용`
   - `v1.0.0`

Return a completion/blocker report to the same Syncthing folder with screenshots, checked URL, release/asset status, file size/SHA256 if built, and the exact URL Mac-side should use for `setupDownloadUrl` if available.

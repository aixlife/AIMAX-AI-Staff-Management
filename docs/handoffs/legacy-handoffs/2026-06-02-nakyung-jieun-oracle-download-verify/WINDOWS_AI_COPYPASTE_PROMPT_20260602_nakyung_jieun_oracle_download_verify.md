AIMAX Windows verification task.

Read the latest handoff doc first:
`C:\Users\aixli\Documents\Shared-Bridge\20_Deploy-To-Windows\2026-06-02-nakyung-pencil-windows-download-verify\WINDOWS_HANDOFF_20260602_nakyung_jieun_oracle_download_verify.md`

Important: Do not use GitHub Release URLs for this task. 나경 and 지은 should download EXE files directly from Oracle:

- `https://api.aimax.ai.kr/downloads/Pencil-Setup-1.0.0.exe`
- `https://api.aimax.ai.kr/downloads/Pencil-portable.exe`
- `https://api.aimax.ai.kr/downloads/AIMAX-Office-Manager-Setup-0.1.4.exe`
- `https://api.aimax.ai.kr/downloads/AIMAX-Office-Manager-portable.exe`

Do not put secrets, passphrases, API keys, cookies, browser profile data, or private account data in Syncthing.

Task:
1. On Windows, open `https://api.aimax.ai.kr/app`.
2. Use an available test/operator login session. If login is unavailable, report that blocker and still verify the four direct Oracle download URLs with HTTP/download checks.
3. In 직원 채용, verify 나경:
   - name `나경`
   - role `판서`
   - `Windows 전용`
   - direct-download employee, not a job composer flow
   - `Setup exe 다운로드` downloads `Pencil-Setup-1.0.0.exe`
4. Verify 지은:
   - name `지은`
   - role `AI 오피스 지원`
   - `Windows 전용`
   - direct-download employee, not a job composer flow
   - `Setup exe 다운로드` downloads `AIMAX-Office-Manager-Setup-0.1.4.exe`
5. Verify downloaded file hashes:
   - `Pencil-Setup-1.0.0.exe`: `6b974365a793826619933f1b0930ce0fbb5ad6bd278781325213afcd4187a4b0`
   - `Pencil-portable.exe`: `d9c31c8a71d88b293957413f71da3735fda8b0a52bfa3eb1eda69406c99f08af`
   - `AIMAX-Office-Manager-Setup-0.1.4.exe`: `82c98c8bfab019adc2ee6b45f0818ff4e5fc1a80a5c39ab8a968b50b89ab9e01`
   - `AIMAX-Office-Manager-portable.exe`: `2b7270153e7d1ad03e209d170ed891598af68dcba1278abf501e980767fab0e8`
6. If admin is accessible, verify `AIMAX Admin > 직원 카탈로그` shows both 나경 and 지은 as `직접 다운로드`, `무료 공개`, `신규 계정 자동 제공`, `Windows 전용`, and the correct version.

Return a completion/blocker report to the same Syncthing folder with screenshots, checked URLs, file names, file sizes, SHA256 values, Windows/browser versions, and any visible errors.

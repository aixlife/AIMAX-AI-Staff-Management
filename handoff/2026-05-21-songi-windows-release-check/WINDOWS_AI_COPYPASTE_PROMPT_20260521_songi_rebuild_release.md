# Windows AI Copy-Paste Prompt: Songi Rebuild Release

송이 Windows 릴리즈 체크 결과, 저장 셋팅은 완료됐지만 현재 Windows `aimax-bundle-windows.exe` v1.0.13은 송이 릴리즈가 `Blocked` 상태야.

이번 작업은 **최신 Mac/web 송이 소스와 media-tools를 Windows 설치파일에 포함해서 다시 빌드하고, 새 artifact 기준으로 재검증**하는 거야.

## 먼저 읽어줘

공유 폴더:

`/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-21-songi-windows-release-check/`

먼저 아래 파일을 읽어줘:

- `SONGI_WINDOWS_REBUILD_HANDOFF_20260521.md`
- `WINDOWS_AI_STATUS_20260521_songi_release_check.md`

## 사용할 자료

- `aimax-songi-latest-web-source-20260521.zip`
- `aimax-songi-latest-web-source-20260521.zip.sha256`
- `aimax-songi-windows-media-tools-bundle-20260519.zip`
- `aimax-songi-windows-media-tools-bundle-20260519.zip.sha256`

## 중요 규칙

- Syncthing 공유 폴더 안에서 직접 빌드하지 말고 Windows 로컬 작업 폴더로 복사해서 진행해줘.
- `.env`, API 키, 토큰, 비밀번호, 쿠키, 브라우저 프로필, signed URL, 복호화된 인증정보는 Syncthing에 넣지 마.
- Gemini/Apify paid call은 승인 없이 실행하지 마. no-paid 검증만 해줘.

## 해야 할 일

1. 최신 Songi web/runtime source를 Windows 릴리즈 소스에 반영해줘.
   - `oracle/aimax-reports-api/server.js`
   - `oracle/aimax-reports-api/static/app.html`
   - `oracle/aimax-reports-api/static/admin.html`
   - `oracle/aimax-reports-api/static/setup.html`
   - `oracle/aimax-reports-api/vendor/media-tools/README.md`

2. media-tools를 Windows 패키지에 포함해줘.
   - `oracle/aimax-reports-api/vendor/media-tools/win32/x64/yt-dlp.exe`
   - `oracle/aimax-reports-api/vendor/media-tools/win32/x64/ffmpeg.exe`
   - `oracle/aimax-reports-api/vendor/media-tools/win32/x64/ffprobe.exe`

3. Windows artifact를 다시 빌드해줘.

4. 새 artifact 기준으로 아래가 포함됐는지 확인해줘.
   - `송이에게 지시`
   - `블로그팀`
   - `전체 통합`
   - `research_paid_operation_in_progress`
   - `research_gemini_high_demand`
   - `yt-dlp.exe`
   - `ffmpeg.exe`
   - `ffprobe.exe`

5. no-paid 검증을 다시 해줘.
   - YouTube basic URL read
   - Instagram/Reels pre-collection 또는 `apify_key_missing`
   - Gemini는 paid confirmation 없으면 `402 research_paid_confirmation_required`
   - Apify item/profile collection도 paid confirmation 없으면 `402 research_paid_confirmation_required`

6. 권한 분기를 확인해줘.
   - `blog_team` = 예리+현주만
   - `bundle` = 예리+현주+송이

7. 송이 오류 보고 redaction을 확인해줘.
   - 공개 YouTube/Instagram URL은 괜찮음
   - signed/private media URL은 host/path/token이 민감 접근정보로 남지 않게 redaction 필요

## 결과 보고

같은 공유 폴더에 새 Markdown 보고서를 남겨줘.

보고서에는 아래를 포함해줘:

- 새 Windows artifact 파일명
- version
- SHA256
- Songi web/runtime source 포함 여부
- media-tools 포함 여부와 실제 경로
- 최신 Mac/web 문자열 포함 여부
- `blog_team` / `bundle` 권한 분기 결과
- YouTube no-paid read 결과
- Instagram/Reels no-paid/pre-collection 결과
- paid-call guard 결과
- 오류 보고 redaction 결과
- 최종 판정: `OK to release` / `Blocked` / `Needs Mac/web follow-up`

새 artifact 자체가 통과하지 않으면 `OK to release`로 쓰지 말고 정확한 blocker를 남겨줘.

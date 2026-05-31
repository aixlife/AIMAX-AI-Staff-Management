# Windows AI Follow-Up Prompt: Rebuild Songi Into Windows Release

송이 체크 보고서 확인 결과, Windows Codex 기억체계 셋팅은 완료됐지만 현재 `aimax-bundle-windows.exe` v1.0.13 릴리즈 artifact는 송이 릴리즈가 막혀 있습니다.

이번 작업은 기존 송이 체크를 이어서 **최신 Mac/web 송이 소스와 media-tools를 Windows v1.0.13 릴리즈 빌드에 포함시키고 재검증**하는 것입니다.

## 반드시 먼저 읽기

공유 폴더:

`/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-21-songi-windows-release-check/`

먼저 아래 보고서를 읽어주세요.

- `WINDOWS_AI_STATUS_20260521_songi_release_check.md`

현재 보고서 판정은 `Blocked`입니다.

## 제공된 자료

최신 Mac/web 송이 소스 zip:

- `aimax-songi-latest-web-source-20260521.zip`
- `aimax-songi-latest-web-source-20260521.zip.sha256`

Windows media-tools 번들:

- `aimax-songi-windows-media-tools-bundle-20260519.zip`
- `aimax-songi-windows-media-tools-bundle-20260519.zip.sha256`

## 작업 목표

1. Syncthing 공유 폴더에서 직접 빌드하지 말고, 필요한 자료를 Windows 로컬 작업 폴더로 복사합니다.
2. 최신 Mac/web 송이 소스를 Windows 릴리즈 소스에 반영합니다.
   - `oracle/aimax-reports-api/server.js`
   - `oracle/aimax-reports-api/static/app.html`
   - `oracle/aimax-reports-api/static/admin.html`
   - `oracle/aimax-reports-api/static/setup.html`
   - `oracle/aimax-reports-api/vendor/media-tools/README.md`
3. media-tools 번들을 아래 경로에 포함시킵니다.
   - `oracle/aimax-reports-api/vendor/media-tools/win32/x64/yt-dlp.exe`
   - `oracle/aimax-reports-api/vendor/media-tools/win32/x64/ffmpeg.exe`
   - `oracle/aimax-reports-api/vendor/media-tools/win32/x64/ffprobe.exe`
4. Windows 릴리즈 artifact를 다시 빌드합니다.
5. 새 artifact에서 아래 문자열/파일이 실제 포함됐는지 확인합니다.
   - `송이에게 지시`
   - `블로그팀`
   - `전체 통합`
   - `research_paid_operation_in_progress`
   - `research_gemini_high_demand`
   - `yt-dlp.exe`
   - `ffmpeg.exe`
   - `ffprobe.exe`
6. no-paid 검증을 다시 실행합니다.
   - YouTube basic URL read
   - Instagram/Reels pre-collection 또는 Apify key missing 상태 확인
   - Gemini/Apify는 `confirm_paid: true` 없이 실행되지 않아야 합니다.
7. 권한 분기를 다시 확인합니다.
   - `blog_team` = 예리+현주
   - `bundle` = 예리+현주+송이
8. 송이 오류 보고의 민감 URL redaction도 확인하거나 보강합니다.
   - 공개 YouTube/Instagram URL은 허용 가능
   - signed/private media URL은 host/path/token 전체가 안전하게 축약 또는 제거되어야 합니다.

## 비용/보안 규칙

- Gemini/Apify paid call은 승인 없이 실행하지 마세요.
- `.env`, API 키, 토큰, 비밀번호, 쿠키, 브라우저 프로필, signed URL은 Syncthing에 넣지 마세요.
- 결과 보고서는 sanitized Markdown으로만 공유하세요.

## 완료 보고서

같은 공유 폴더에 새 Markdown 보고서를 남겨주세요.

필수 항목:

- 새 Windows artifact 파일명
- artifact version
- artifact SHA256
- media-tools 포함 여부와 실제 경로
- 최신 송이 문자열 포함 여부
- `blog_team` / `bundle` 권한 분기 결과
- YouTube no-paid read 결과
- Instagram/Reels no-paid/pre-collection 결과
- paid-call guard 결과
- 오류 보고 redaction 결과
- 최종 판정:
  - `OK to release`
  - `Blocked`
  - `Needs Mac/web follow-up`

이번 후속 작업의 목표는 `OK to release`가 아니라, 실제로 통과하지 않으면 정확한 blocker를 남기는 것입니다.

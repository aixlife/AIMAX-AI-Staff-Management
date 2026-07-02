# Windows AI Developer Prompt: Songi Release Check + Codex Memory Setup

아래 내용을 먼저 읽고 그대로 진행해줘. 이번 요청은 두 가지야.

1. 송이 Windows 릴리즈 가능 여부 확인
2. Windows Codex도 MacBook처럼 `작업끝` 시 세션 기록/인사이트/결정을 저장하도록 셋팅

작업 폴더:

`/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-21-songi-windows-release-check/`

먼저 이 폴더의 최신 handoff 문서를 읽어줘:

`SONGI_WINDOWS_RELEASE_CHECK.md`

중요 규칙:

- Syncthing 공유 폴더 안에서 직접 빌드하거나 실행하지 말고, 필요한 파일은 Windows 로컬 작업 폴더로 복사해서 진행해줘.
- `.env`, API 키, 토큰, 비밀번호, 브라우저 프로필, 복호화된 인증정보는 Syncthing에 넣지 마.
- Gemini/Apify 같은 유료 호출은 명시적인 승인 없이 실행하지 마. 먼저 no-paid/basic URL read 검증만 해줘.
- 결과 보고서는 같은 Syncthing 폴더에 Markdown으로 남겨줘.
- 전체 세션 로그 원본은 Windows 로컬 Obsidian vault 또는 로컬 로그 폴더에 저장하고, Syncthing에는 필요한 요약만 남겨줘.

## 1. 송이 Windows 릴리즈 체크

1. Windows 패키지/런타임에 송이 영상 분석용 도구가 포함되어 있는지 확인:
   - `yt-dlp.exe`
   - `ffmpeg.exe`
   - `ffprobe.exe`

2. Windows 패키지 상태에서 송이가 브라우저 창을 띄우지 않고 백엔드에서 URL 분석을 실행할 수 있는지 확인:
   - YouTube 링크 no-paid/basic read
   - 가능하면 공개 Instagram/Reels 링크 no-paid/basic read 또는 수집 전 단계까지

3. paid-call guard 확인:
   - Gemini 분석은 명시적 paid confirmation 없이는 실행되면 안 됨
   - Apify/SNS 수집도 명시적 paid confirmation 없이는 실행되면 안 됨
   - 같은 자료/단계 중복 유료 실행이 차단되거나 복구 가능해야 함

4. 권한 분기 확인:
   - `blog_team`은 예리+현주만 보여야 함
   - `bundle`은 예리+현주+송이가 보여야 함

5. 송이 실패가 기존 오류 보고 흐름으로 제출 가능한지 확인:
   - 직원명, 작업/단계, 원본 URL 또는 job id, 오류 메시지, 환경 진단이 sanitized 형태로 들어가야 함
   - API 키/토큰/비밀번호/서명 URL/민감한 원본 미디어 URL은 들어가면 안 됨

## 2. Windows Codex 세션 저장 셋팅

MacBook Codex와 같은 방식으로, Windows Codex도 사용자가 아래 표현을 입력하면 세션 요약을 저장하게 셋팅해줘.

트리거:

- `작업끝`
- `오늘 작업 끝`
- `세션 마무리`
- `정리하고 끝내자`
- `마무리 저장`
- `저장하고 종료`

저장 위치:

- Windows에 Obsidian vault가 있으면 우선 사용:
  - `C:\Users\<USER>\Documents\creator-os-vault\sessions\AIMAX-AI-Staff-Management\`
  - `C:\Users\<USER>\Documents\creator-os-vault\projects\AIMAX-AI-Staff-Management.md`
  - `C:\Users\<USER>\Documents\creator-os-vault\daily\`
  - `C:\Users\<USER>\Documents\creator-os-vault\decisions\`
  - `C:\Users\<USER>\Documents\creator-os-vault\insights\`

- Obsidian vault가 없으면 로컬 로그 폴더를 만들어 사용:
  - `C:\Users\<USER>\Documents\Codex-Session-Logs\AIMAX-AI-Staff-Management\`
  - 그 아래 `sessions`, `projects`, `daily`, `decisions`, `insights`, `concepts` 폴더를 만듦

세션 종료 시 반드시 저장할 섹션:

- `Summary`: 한 줄 요약
- `Decisions`: 앞으로 기준으로 삼을 결정, 각 항목 끝에 `#decision`
- `Insights`: 다음 세션에서도 재사용할 깨달음/운영 패턴, 각 항목 끝에 `#insight`
- `Changes`: 변경한 파일/기능/설정
- `Verification`: 실행한 테스트, 빌드, 브라우저 확인, 배포 확인
- `Open Issues`: 남은 문제, 막힌 점, 사용자 확인 필요 사항
- `Next Actions`: 다음 세션이 바로 이어서 할 일
- `Connected Context`: 이 세션이 어떤 프로젝트/결정/인사이트/이전 세션과 연결되는지

다음 세션 시작 시 동작:

- AIMAX 관련 작업을 넓게 시작할 때 프로젝트 메모리와 최신 관련 세션 1-2개를 먼저 읽도록 Windows AGENTS.md 또는 Codex 시작 규칙에 넣어줘.
- 세션 로그에만 있는 중요한 결정/인사이트가 있으면, 사용자가 요청하거나 현재 작업에 필요할 때 프로젝트 메모리로 승격해줘.

보안 규칙:

- API 키, 토큰, 비밀번호, `.env`, 브라우저 프로필, 서명 URL, 유료 provider credential은 세션 로그와 Syncthing에 저장하지 마.
- 외부 공유가 필요한 경우에도 sanitized summary만 공유해줘.

## 결과 보고서 형식

같은 Syncthing 폴더에 Markdown 보고서를 남기고 아래 항목을 포함해줘:

- Windows build/version
- 테스트한 설치파일 또는 artifact 이름
- media-tools 포함 여부와 실제 경로
- 테스트 계정 권한: `blog_team` 또는 `bundle`
- 송이 UI 표시 여부
- YouTube basic URL read 결과
- Instagram/Reels 결과 또는 미테스트 사유
- paid-call guard 결과
- 오류 보고 결과
- Windows Codex 세션 저장 셋팅 결과
- 실제 세션 로그 저장 경로
- 다음 세션 시작 시 memory/session-log 읽기 규칙 반영 여부
- 최종 판정: `OK to release` / `Blocked` / `Needs Mac/web follow-up`

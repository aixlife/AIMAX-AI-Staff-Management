# Windows Handoff - AIMAX Brain 대시보드 영상 검수

날짜: 2026-06-01 KST
작성: Mac Codex
상태: Windows 운영 UI 검수 요청

## 목적

AIMAX 운영 웹앱 대시보드의 `AIMAX Brain` 카드 안에 있던 기존 뇌 지도 시각 요소를 가벼운 자동 재생 영상으로 교체했습니다. Windows Chrome에서 영상이 자연스럽게 로딩/재생되는지 확인합니다.

## 변경 요약

- 원본: `/Users/aixlife/Documents/옵시디언 후킹용.mov`
- 웹 자산:
  - `/assets/aimax-brain-preview.webm` 약 194KB, Chrome 우선
  - `/assets/aimax-brain-preview.mp4` 약 119KB, fallback
- video 속성: `autoplay muted loop playsinline preload="auto"`
- 서버 보강:
  - `.webm` → `video/webm`
  - `.mp4` → `video/mp4`
  - 정적 자산 `Accept-Ranges: bytes`
  - 영상 byte-range 요청 `206 Partial Content`
- 운영 배포 리포트: `docs/deployments/oracle-deploy-20260601-173158.md`

## Mac/운영 검증 완료

- `node --check oracle/aimax-reports-api/server.js`: 통과
- app/admin inline script parse: 통과
- worker catalog smoke: 통과
- 로컬 대시보드 Playwright:
  - `.brain-video` 존재
  - WebM 소스 선택
  - `readyState=4`
  - `paused=false`
  - `currentTime` 진행 확인
  - 기존 `.brain-map` 없음
- 운영 asset:
  - `https://api.aimax.ai.kr/assets/aimax-brain-preview.webm` HEAD 200, `video/webm`, `Accept-Ranges: bytes`
  - Range 요청 206 확인
- 운영 app HTML:
  - `.brain-video`
  - `aimax-brain-preview.webm`
  - `aimax-brain-preview.mp4`

## Windows 검수 절차

1. Syncthing 공유 폴더의 handoff를 먼저 읽습니다.
2. 코드는 수정하지 않습니다. 운영 UI 검수만 합니다.
3. Windows Chrome에서 `https://api.aimax.ai.kr/app`을 엽니다.
4. 승인된 테스트 계정/세션으로 로그인합니다. 비밀번호, 쿠키, 토큰은 기록하지 않습니다.
5. 브라우저 전체 reload를 한 번 수행합니다.
6. 대시보드의 `AIMAX Brain` 카드 안에 영상이 보이는지 확인합니다.
7. 기존 뇌 지도 이미지/노드 대신 영상이 들어갔는지 확인합니다.
8. 영상이 자동 재생되는지 확인합니다. 음성은 없어야 합니다.
9. 화면 깨짐, 과도한 로딩, 가로 스크롤, 카드 밖 overflow가 없는지 확인합니다.
10. 스크린샷을 같은 폴더에 저장합니다.

## 반환 기대값

같은 Syncthing 폴더에 아래 파일을 남깁니다.

- `WINDOWS_RESULT_20260601_aimax_brain_video_verify.md`
- 스크린샷 파일 1개 이상

결과 문서에는 Windows OS/브라우저, 테스트 계정 식별자(마스킹), 영상 표시 여부, 자동 재생 여부, 음소거 여부, 레이아웃 깨짐 여부, blocker를 포함해주세요.

## 금지

- Secrets, passphrases, API keys, cookies, raw session tokens, private account data를 Syncthing에 저장하지 않습니다.
- 운영 코드 수정, 배포, 버전 API 수정은 하지 않습니다.
- 설치 파일 실행이나 유료 API 호출은 하지 않습니다.

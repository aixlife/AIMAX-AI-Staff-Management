# Windows Handoff - AIMAX Brain 고화질 영상 교체 검수

날짜: 2026-06-01 KST
작성: Mac Codex
상태: Windows 운영 UI 검수 요청

## 목적

AIMAX 운영 웹앱 대시보드의 `AIMAX Brain` 영상을 새 회사 Obsidian 영상으로 교체했습니다. 기존 720px 영상은 큰 화면에서 흐릿하다는 피드백이 있어 1440x984로 재인코딩했습니다. Windows Chrome/Edge에서 운영 UI가 새 고화질 영상을 받는지 확인합니다.

## 변경 요약

- 운영 URL: `https://api.aimax.ai.kr/app`
- 교체 자산:
  - `/assets/aimax-brain-preview.mp4?v=20260601-hires`
  - `/assets/aimax-brain-preview.webm?v=20260601-hires`
- MP4 우선 로딩으로 변경했습니다. 이 원본은 H.264 MP4가 WebM보다 더 작고 안정적으로 선명했습니다.
- 새 MP4: 1440x984, 24fps, 약 7.9MB, 무음.
- 새 WebM fallback: 1440x984, 24fps, 약 9.5MB, 무음.
- 로그인 후 대시보드가 표시될 때 무음 영상 재생 요청을 한 번 더 수행하도록 보강했습니다.
- 기존 문구 중 `실제 개인 노트명은 노출하지 않습니다`는 제거했습니다. 새 영상에는 회사 Obsidian 노트 제목이 보이는 프레임이 있습니다.
- 운영 배포 기록: `docs/deployments/oracle-deploy-20260601-204440-brain-video-replace.md`

## Mac/운영 검증 완료

- 로컬 데스크톱 1440x900: MP4 선택, `videoWidth=1440`, `videoHeight=984`, `paused=false`, `currentTime` 진행.
- 로컬 모바일 390x844: MP4 선택, 가로 overflow 없음, `paused=false`, `currentTime` 진행.
- 운영 MP4 HEAD: 200, `video/mp4`, `Accept-Ranges: bytes`, `Content-Length: 8279760`.
- 운영 MP4 Range: 206 Partial Content.
- 운영 app HTML: `?v=20260601-hires`와 `ensureBrainVideoPlayback` 반영 확인.
- 원격 SHA가 로컬 SHA와 일치.

## Windows 검수 절차

1. Syncthing 공유 폴더의 handoff를 먼저 읽습니다.
2. 코드는 수정하지 않습니다. 운영 UI 검수만 합니다.
3. Windows Chrome 또는 Edge에서 `https://api.aimax.ai.kr/app`을 엽니다.
4. 승인된 AIMAX 테스트 계정/세션으로 로그인합니다. 비밀번호, 쿠키, 토큰, API 키는 문서나 Syncthing에 저장하지 않습니다.
5. 전체 새로고침을 한 번 수행합니다.
6. 대시보드 `AIMAX Brain` 카드 안에 새 회사 Obsidian 영상이 표시되는지 확인합니다.
7. 개발자 도구 또는 브라우저 콘솔 사용이 가능하면 아래를 확인합니다.
   - `.brain-video.currentSrc`가 `aimax-brain-preview.mp4?v=20260601-hires`를 포함하는지
   - `video.videoWidth === 1440`
   - `video.videoHeight === 984`
   - `video.paused === false`
   - `video.currentTime`이 1초 이상 진행되는지
8. 화면 크기를 넓게 했을 때 기존보다 흐릿함이 줄었는지 눈으로 확인합니다.
9. 모바일 폭 또는 좁은 창에서도 가로 스크롤/카드 overflow가 없는지 확인합니다.
10. 스크린샷을 같은 폴더에 저장합니다.

## 반환 기대값

같은 Syncthing 폴더에 아래 파일을 남깁니다.

- `WINDOWS_RESULT_20260601_brain_video_hires_verify.md`
- 스크린샷 1개 이상

결과 문서에는 Windows OS/브라우저, 테스트 계정 식별자(마스킹), 새 영상 표시 여부, MP4 소스 선택 여부, 자동 재생 여부, 해상도 확인 여부, 큰 화면 품질 체감, 가로 overflow 여부, blocker를 포함해주세요.

## 금지

- Secrets, passphrases, API keys, cookies, raw session tokens, private account data를 Syncthing에 저장하지 않습니다.
- 운영 코드 수정, 배포, 버전 API 수정은 하지 않습니다.
- 설치 파일 실행이나 유료 API 호출은 하지 않습니다.

아래 handoff 문서를 먼저 읽고 Windows 운영 UI 검수를 진행해주세요.

`Shared-Bridge/20_Deploy-To-Windows/2026-06-01-brain-video-hires-windows-verify/WINDOWS_HANDOFF_20260601_brain_video_hires_verify.md`

목표:
1. Windows Chrome 또는 Edge에서 `https://api.aimax.ai.kr/app`을 엽니다.
2. 승인된 AIMAX 테스트 계정/세션으로 로그인합니다. 비밀번호, 쿠키, 토큰, API 키는 Syncthing에 저장하거나 결과 문서에 쓰지 마세요.
3. 대시보드 `AIMAX Brain` 카드에 새 회사 Obsidian 영상이 보이는지 확인합니다.
4. 가능하면 브라우저 콘솔/개발자 도구로 `.brain-video`의 `currentSrc`가 `aimax-brain-preview.mp4?v=20260601-hires`를 포함하는지, `videoWidth=1440`, `videoHeight=984`, `paused=false`, `currentTime` 진행을 확인합니다.
5. 넓은 화면에서 기존보다 영상이 덜 흐릿한지 눈으로 확인하고, 좁은 창/모바일 폭에서도 가로 overflow가 없는지 확인합니다.
6. Windows/local-agent 코드 변경, 설치파일 실행, 배포, 버전 API 수정, 유료 API 호출은 하지 마세요. 이번 건은 운영 웹 UI 검수입니다.
7. 결과를 같은 폴더에 `WINDOWS_RESULT_20260601_brain_video_hires_verify.md`로 남기고, 스크린샷도 같은 폴더에 저장해주세요.

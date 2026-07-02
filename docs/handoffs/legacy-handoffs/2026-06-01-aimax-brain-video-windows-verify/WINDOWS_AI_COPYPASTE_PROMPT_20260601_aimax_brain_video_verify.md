아래 handoff를 먼저 읽고 Windows 운영 UI 검수를 진행하세요.

`Shared-Bridge/20_Deploy-To-Windows/2026-06-01-aimax-brain-video-windows-verify/WINDOWS_HANDOFF_20260601_aimax_brain_video_verify.md`

중요:
- Syncthing 안에서 빌드/수정하지 마세요.
- 이번 작업은 운영 UI 검수만 합니다. 코드는 수정하지 마세요.
- 비밀번호, 쿠키, 토큰, API 키, private account data를 Syncthing에 남기지 마세요.
- 설치 파일 실행이나 유료 API 호출은 하지 마세요.

검수 항목:
1. Windows Chrome에서 `https://api.aimax.ai.kr/app`을 엽니다.
2. 승인된 테스트 계정/세션으로 로그인합니다.
3. 브라우저 전체 reload 후 대시보드를 확인합니다.
4. `AIMAX Brain` 카드 안에 기존 뇌 지도 이미지/노드 대신 영상이 보이는지 확인하세요.
5. 영상이 자동 재생되는지 확인하세요. 음성은 없어야 합니다.
6. 화면 깨짐, 과도한 로딩, 가로 스크롤, 카드 밖 overflow가 없는지 확인하세요.
7. 결과를 같은 폴더에 `WINDOWS_RESULT_20260601_aimax_brain_video_verify.md`로 남기고, 스크린샷도 같은 폴더에 저장하세요.

반환 결과에는 Windows 브라우저/OS 정보, 테스트 계정 식별자(마스킹), 영상 표시 여부, 자동 재생 여부, 음소거 여부, 레이아웃 깨짐 여부, blocker를 포함해주세요.

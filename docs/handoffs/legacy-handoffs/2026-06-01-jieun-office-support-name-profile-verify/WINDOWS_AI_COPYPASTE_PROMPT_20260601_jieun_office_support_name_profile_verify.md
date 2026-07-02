아래 handoff를 먼저 읽고 Windows 운영 UI 검수를 진행하세요.

`Shared-Bridge/20_Deploy-To-Windows/2026-06-01-jieun-office-support-name-profile-verify/WINDOWS_HANDOFF_20260601_jieun_office_support_name_profile_verify.md`

중요:
- Syncthing 안에서 빌드/수정하지 마세요.
- 이번 작업은 운영 UI 검수만 합니다. 코드는 수정하지 마세요.
- 비밀번호, 쿠키, 토큰, API 키, private account data를 Syncthing에 남기지 마세요.
- 설치 파일 실행이나 유료 API 호출은 하지 마세요.

검수 항목:
1. Windows Chrome에서 `https://api.aimax.ai.kr/app`을 엽니다.
2. 승인된 테스트 계정/세션으로 로그인합니다.
3. 브라우저 전체 reload 후 `직원` 탭으로 갑니다.
4. 직원 카드가 `지원`이 아니라 `지은`으로 보이는지 확인하세요.
5. 상세가 `AI 오피스 지원`, 프로필 이미지 `/assets/avatar_jieun.jpg` 기반 새 인물 이미지, Windows에서 `다운로드 가능`, 버튼 `Setup exe 다운로드`로 보이는지 확인하세요.
6. 예전 이름 `지원`이 직원명으로 남아 있지 않은지 확인하세요. 단, 역할명 `AI 오피스 지원` 안의 `지원` 단어는 정상입니다.
7. Admin 접근이 가능하면 `AIMAX Admin > 직원 카탈로그`에서 `지은`이 `직접 다운로드`, `무료 공개`, `신규 계정 자동 제공`, `Windows 전용`, `v0.1.4`로 표시되는지 확인하세요.
8. 결과를 같은 폴더에 `WINDOWS_RESULT_20260601_jieun_office_support_name_profile_verify.md`로 남기고, 스크린샷도 같은 폴더에 저장하세요.

반환 결과에는 Windows 브라우저/OS 정보, 테스트 계정 식별자(마스킹), 지은 카드 표시 여부, 예전 이름 잔존 여부, 프로필 이미지 표시 여부, 다운로드 버튼 상태, Admin 카탈로그 확인 여부, blocker를 포함해주세요.

아래 handoff 문서를 먼저 읽고 Windows 검수를 진행해주세요.

`Shared-Bridge/20_Deploy-To-Windows/2026-06-01-jiwon-office-support-download-verify/WINDOWS_HANDOFF_20260601_jiwon_office_support_download_verify.md`

목표:

1. Windows 실제 브라우저에서 `https://api.aimax.ai.kr/app`를 열어주세요.
2. 승인된 AIMAX 테스트 계정/세션으로 로그인하세요. 비밀번호, 토큰, 쿠키, API 키는 Syncthing에 저장하거나 결과 문서에 쓰지 마세요.
3. `직원` 탭에서 새 직원 `지원`이 보이는지 확인하세요.
4. `지원` 상세가 `AI 오피스 지원`, `다운로드 가능`, `Windows 전용`, `Setup exe 다운로드`로 보이는지 확인하세요.
5. `Setup exe 다운로드` 버튼을 클릭해 다운로드가 시작되는지 확인하세요.
6. 다운로드 파일명이 `AIMAX-Office-Manager-Setup-0.1.4.exe`인지 확인하세요. 가능하면 파일 크기가 약 153.7MB 또는 `161141736` bytes 수준인지 확인하세요.
7. Admin 접근이 가능하면 `AIMAX Admin > 직원 카탈로그`에서 `지원`이 `무료 공개`, `신규 계정 자동 제공`, `Windows 전용`, `v0.1.4`로 표시되는지 확인하세요.
8. 이번 검수에서는 코드 수정, 유료 AI/Apify/Naver 자동화, AIMAX 실행기 버전 API 변경, 설치파일 교체를 하지 마세요.
9. 결과를 같은 폴더에 `WINDOWS_RESULT_20260601_jiwon_office_support_download_verify.md`로 남겨주세요. 스크린샷이 있으면 같은 폴더에 저장하고 파일명만 결과에 적어주세요.

반환 결과에는 Windows 브라우저/OS 정보, 테스트 계정 식별자(마스킹), 지원 카드 표시 여부, 다운로드 버튼 상태, 다운로드 파일명/크기, Admin 카탈로그 확인 여부, blocker를 포함해주세요.

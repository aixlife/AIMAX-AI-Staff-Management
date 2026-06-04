Windows AI 개발자님, 아래 handoff를 먼저 읽고 AIMAX 운영 웹의 대시보드 얼굴 이미지 복구 및 PC 6:1 배너 조정을 Windows에서 실제 사용자 경로로 검증해주세요.

읽을 문서:

- `WINDOWS_HANDOFF_20260601_face_dashboard_restore_verify.md`
- 가능하면 `docs/deployments/oracle-deploy-20260601-195232.md`
- 가능하면 `docs/deployments/oracle-deploy-20260601-195626.md`
- 가능하면 `docs/deployments/oracle-deploy-20260601-200656.md`

작업:

1. Windows 브라우저에서 `https://api.aimax.ai.kr/app` 접속.
2. 승인된 테스트 계정/세션으로 로그인. 고객 계정/비밀번호/비밀 값은 사용하거나 기록하지 말 것.
3. `대시보드` 첫 화면에서 실제 직원 얼굴 사진 4장이 보이고 부드럽게 움직이는지 확인.
4. 픽셀 캐릭터/픽셀 사무실 배경이 보이지 않는지 확인.
5. 큰 화면에서 얼굴 영역이 가로로 긴 `6:1` 배너처럼 보이고, 빈 세로 공간이 줄었는지 확인.
6. 모바일 폭에서는 기존처럼 `16:9`에 가까운 균형으로 보이는지 확인.
7. `직원 채용` / `직원 업무지시` 사이드바 라벨이 유지되는지 확인.
8. 예전 카드인 `내 AI 직원`과 `확인할 항목`이 대시보드에 다시 보이지 않는지 확인.
9. AIMAX Brain 미리보기가 얼굴 영역 아래에 크게 유지되는지 확인.
10. 스크린샷과 콘솔/네트워크 오류 여부를 남길 것.

주의:

- 이번 작업은 운영 웹 화면 확인만이며 Windows 설치파일/로컬 실행기/Naver 자동화/유료 AI/Apify 실행은 하지 말 것.
- 비밀번호, API 키, 쿠키, 토큰, 고객 데이터는 공유 폴더에 남기지 말 것.
- Syncthing 공유 폴더 안에서 빌드하지 말 것.

결과:

- 같은 공유 폴더에 Windows 완료/차단 보고서를 Markdown으로 작성.
- 포함 항목: 브라우저/버전, 계정 이메일만, 스크린샷 경로, 실제 얼굴 visual/gentle motion/desktop 6:1 banner/mobile 16:9 layout/no pixel visual/no old cards/sidebar labels/Brain preview의 pass/fail, 발견한 오류.

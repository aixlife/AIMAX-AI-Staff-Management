# Windows Codex Copy-Paste Prompt

Windows 환경의 Codex에서 R1 Data Safety Hotfix smoke를 진행해주세요.

먼저 읽을 문서:

1. `docs/maintenance_reports/aimax_cross_environment_phase_plan_20260523.md`
2. `docs/maintenance_reports/aimax_release_reality_check_20260523.md`
3. `docs/maintenance_reports/aimax_r1_data_safety_hotfix_20260523.md`
4. `docs/deployments/oracle-deploy-20260523-173412.md`
5. `WINDOWS_HANDOFF_20260523_r1_data_safety_hotfix.md`

목표:

R1은 서버 저장 안정화 hotfix입니다. Windows installer 재빌드가 아니라, 운영 서버 배포 후 Windows 웹/실행기 흐름이 그대로 정상인지 확인해주세요.

금지:

- 실제 Naver 저장/발행/임시저장 금지
- paid AI call 금지
- paid Apify Actor run 금지
- API key, cookie, `.env`, browser profile, signed URL, raw private log 공유 금지

확인:

1. `/api/reports/health`에서 `storage.ok=true`, `storage.issues=[]`
2. `/api/version?platform=windows&current=v1.0.17`에서 update required false
3. 웹 로그인 확인
4. Windows 실행기 연결 확인
5. AI/API 연결 상태 화면 접근
6. 오류 보고 화면 접근
7. dashboard/agent status 무한 loading/busy 없음

반환:

`WINDOWS_RESULT_20260523_r1_data_safety_hotfix.md`

포함:

- Windows OS/브라우저/실행기 버전
- health/storage 확인 결과
- version API 확인 결과
- 웹 로그인/agent status 결과
- AI/API 연결 화면 결과
- 오류 보고 화면 결과
- blocker 목록
- no-paid/no-Naver-publish 원칙 준수 여부


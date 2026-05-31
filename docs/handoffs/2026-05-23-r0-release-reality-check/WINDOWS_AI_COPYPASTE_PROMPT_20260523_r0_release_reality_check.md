# Windows Codex Copy-Paste Prompt

아래 작업을 Windows 환경의 Codex에서 진행해주세요.

먼저 읽을 문서:

1. `docs/maintenance_reports/aimax_cross_environment_phase_plan_20260523.md`
2. `docs/deployments/oracle-deploy-20260523-051021.md`
3. `docs/ai_staff_rephase_20260523.md`
4. 이 폴더의 `WINDOWS_HANDOFF_20260523_r0_release_reality_check.md`

목표:

운영 서버에 반영된 AIMAX Phase 0~4가 Windows 실제 사용자 여정에서 막히지 않는지 R0 Release Reality Check를 수행해주세요.

중요:

- 당신은 별도 “Windows AI”가 아니라 **Windows PC 환경의 Codex**입니다.
- MacBook 환경의 Codex/Claude Code/Antigravity와 역할을 분리해서, Windows 설치/실행기/업데이트/로컬 설정/브라우저 흐름만 실제 검증합니다.
- Syncthing 공유 폴더 안에서 직접 빌드하지 마세요. 필요한 경우 로컬 Windows 작업 폴더로 복사해서 확인하세요.

금지:

- 실제 Naver 저장/발행/publish/save 금지
- paid AI call 금지
- paid Apify Actor run 금지
- API key, cookie, .env, browser profile, signed URL, raw private log를 Shared-Bridge에 저장 금지
- customer data 원문 복원 시도 금지

검증 범위:

1. Windows AIMAX 실행기가 v1.0.17로 업데이트되는지 확인
2. 웹 로그인과 실행기 연결 확인
3. 실행기 연결 후 dashboard가 무한 로딩에 빠지지 않는지 확인
4. 웹에서 로컬 설정 열기 확인
5. 로컬 설정 저장 후 창 재오픈/무한 로딩/키 삭제가 없는지 확인
6. 웹 `AI/API 연결`에서 `기존 실행기 키 가져오기` 버튼과 상태 표시 확인
7. `import_local_provider_secrets` command가 Windows agent에서 지원되는지 확인
8. 예리/현주 local-agent-required, 송이/윤미 web-first/beta 표시가 맞는지 확인
9. 오류 발생 시 한국어 안내와 sanitized 오류 보고 흐름이 있는지 확인

반환:

같은 공유 폴더에 아래 파일을 작성해주세요.

`WINDOWS_RESULT_20260523_r0_release_reality_check.md`

반환 파일에는 다음을 포함해주세요.

- Windows OS/브라우저/실행기 버전
- 설치/업데이트 결과
- 웹 로그인/실행기 연결 결과
- 로컬 설정 열기/저장 결과
- AI/API 연결 및 기존 실행기 키 가져오기 결과
- 직원 카드/작업 흐름 확인 결과
- 오류 보고 확인 결과
- blocker 목록
- no-paid/no-Naver-publish 원칙 준수 여부
- installer hash/size가 확인 가능하면 기록

완료 기준:

- Windows v1.0.17 설치/업데이트 흐름 확인
- 실행기 연결 후 무한 로딩 없음
- 로컬 설정 열기/저장 후 사용자 흐름이 막히지 않음
- AI/API 연결과 기존 실행기 키 가져오기 UX 확인
- no-paid/no-Naver-publish 원칙 준수
- blocker가 있으면 완료가 아니라 `blocked`로 반환


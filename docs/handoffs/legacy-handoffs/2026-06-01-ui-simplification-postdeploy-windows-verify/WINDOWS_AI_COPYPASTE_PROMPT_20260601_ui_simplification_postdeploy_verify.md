아래 handoff를 먼저 읽고 Windows 설치형 사용자 흐름만 검증해주세요.

Syncthing 폴더:

`20_Deploy-To-Windows/2026-06-01-ui-simplification-postdeploy-windows-verify/`

읽을 문서:

`WINDOWS_HANDOFF_20260601_ui_simplification_postdeploy_verify.md`

요약:

- AIMAX 웹 UI 단순화가 Oracle production에 배포되었습니다.
- 배포 문서: `docs/deployments/oracle-deploy-20260601-051846.md`
- 운영 URL: `https://api.aimax.ai.kr/app`
- 이번 변경은 웹 UI-only입니다. Windows runner, 설치파일, 버전 API, 유료 AI, Apify, Naver 자동화는 변경하지 않았습니다.
- Windows 코드 변경이나 빌드는 지금 요청하지 않습니다. 설치된 Windows AIMAX 통합 실행기 기준으로 실제 사용자 화면만 확인해주세요.

확인할 것:

1. 운영 웹앱 로그인 후 메뉴가 `대시보드 / 직원 / 일시키기 / 설정 / 업데이트 및 오류보고`로 보이는지 확인.
2. `일시키기`가 기존 내부 selector `data-tab="jobs"` 기반으로 정상 열리는지 확인.
3. 내가 채용/권한 있는 직원이 보이고 예리/현주/송이 폼이 기존 조건대로 보이는지 확인. 단, 유료 AI 작업이나 네이버 발행/예약/실제 제출은 하지 마세요.
4. `설정`에서 `로컬 설정 열기`가 유지되는지 확인.
5. `업데이트 및 오류보고`에서 업데이트 상태, 설치 파일, 오류 보고 폼, 내 오류 보고 목록이 한 화면에서 확인되는지 확인.
6. 필수 업데이트/업데이트 있음 안내가 여전히 `업데이트 및 오류보고`로 이어지는지 확인.
7. Windows smoke/test/script 중 화면 텍스트 `작업`에 의존해서 깨지는 항목이 있는지 확인.

주의:

- 고객 계정/비밀번호/API 키/토큰/쿠키/signed URL을 Syncthing에 넣지 마세요.
- 유료 AI 생성, Apify paid collection, Naver 발행, Naver 예약은 실행하지 마세요.
- 공유 폴더 안에서 빌드하지 마세요. 이번에는 빌드 요청 자체가 아닙니다.

결과 Markdown에 포함:

- Windows 코드 변경 필요 여부: yes/no
- 설치형 실행기 버전과 플랫폼
- 사용한 테스트 계정 이메일 또는 라벨만, 비밀번호/토큰 제외
- 스크린샷 또는 보이는 텍스트 증거
- selector/text regression 여부
- Syncthing에 비밀값을 넣지 않았다는 확인
- 유료 AI/Apify/Naver publish/schedule을 실행하지 않았다는 확인

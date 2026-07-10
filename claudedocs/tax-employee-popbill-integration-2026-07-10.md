# 세무 직원(세금계산서 발행) 통합 스펙

작성일: 2026-07-10
상태: 대기 (다음 AIMAX 세션에서 착수)
첫 사용자: 윤대표 (Windows, CLI 설치를 어려워함 — 설치형/앱 내 직원 선호)

## 목표

AIMAX AI 직원으로 "세무 직원"을 추가한다. 사용자가 거래처·금액을 입력하면 전자세금계산서 초안을 만들고, 사용자 승인 후에만 발행한다. 독립 설치형 앱을 따로 만들지 않고 기존 AIMAX 배포·업데이트·오류보고 인프라를 재사용한다 (2026-07-10 민수 결정).

## 배경

- 팝빌(popbill) API가 전자세금계산서 발행·조회를 제공한다. k-skill의 `popbill` 스킬과 `korean-jangbu-for` 스킬 참조 사본이 `/Users/aixlife/Projects/MakeFamily/.claude/skills/`에 있다 (SKILL.md + scripts + tests).
- 팝빌은 테스트베드(모의 환경)를 제공한다. 개발·검증은 전부 테스트베드에서 하고, 실발행은 건당 과금이다.
- 윤대표용 Codex 프롬프트(임시 경로): `/Users/aixlife/Projects/MakeFamily/docs/yoon-tax-invoice-codex-prompt-2026-07-10.md` — 세무 직원이 출시되면 이 경로는 폐기한다.

## 착수 절차

0. `docs/runbooks/aimax-employee-release.md`(Employee Launch Checklist)를 먼저 읽고 web-first / local-agent-required / hybrid를 결정한다.
   - 판단 힌트: 팝빌은 서버-투-서버 API라 web-first가 유력하다. 체크리스트의 "web-entered per-user provider secrets stored server-side with encryption" 패턴에 부합. 브라우저 자동화·로컬 파일 의존이 없다.
1. 직원 정의: 이름/역할/프로필 자산 확인 (없으면 placeholder + TODO).
2. 기능 범위 1차 (MVP):
   - 팝빌 연동 설정 화면: 사업자번호, API 키(LinkID/SecretKey) 입력창 → 서버측 암호화 저장, 상태만 응답
   - 테스트베드/실운영 토글 (기본값 테스트베드)
   - 단건 세금계산서 초안 생성: 거래처 사업자번호·상호·공급가액·품목 입력 → 초안 미리보기
   - 발행 버튼 = 사용자 승인 게이트. 발행 전 예상 비용(건당 요금) 표시
   - 발행 이력 조회
3. 제외 (1차에서 만들지 않음): 자동 발행, 대량 발행, 홈택스 수집, 문자/팩스 발송, 계좌조회.

## 제약 (필수)

- 자동 발행 금지. 초안까지 자동 + 발행은 사용자 승인.
- 실발행은 건당 과금 — 발행 전 비용 표시 + 명시 승인. 실패 후 자동 재시도 금지 (중복 발행 위험).
- 팝빌 키는 서버측 암호화 저장, 응답은 상태만, 삭제/교체 UI 제공 (Employee Launch Checklist의 web-first secrets 패턴).
- 세금계산서는 법적 효력 문서 — 필드 정확성(공급자/공급받는자/작성일자/공급가액/세액) 검증을 테스트베드에서 케이스별로 통과해야 한다.
- 오류는 기존 웹 오류 보고 플로우로 접수 가능해야 한다 (sanitized context 포함).

## 검증 기준

1. 테스트베드에서 초안 생성 → 승인 → 발행 → 이력 조회 전체 플로우 통과.
2. 잘못된 사업자번호·필수 필드 누락·키 오류 케이스에서 안전하게 실패하고 사용자에게 이유를 보여준다.
3. 실운영 토글 시 발행 직전 비용 고지 + 승인 게이트가 우회 불가능하다.
4. 윤대표 온보딩: 설치/설정을 입력창 흐름만으로 완료할 수 있다 (CLI 조작 없음).

## 착수 명령 예시

"세무 직원 스펙(claudedocs/tax-employee-popbill-integration-2026-07-10.md)대로 진행하자."

# AIMAX Test Accounts

이 문서는 반복 테스트에 쓰는 비고객 계정의 비밀 없는 운영 메타데이터만 기록한다. 비밀번호, API 키, 세션 토큰, 네이버 계정 정보는 절대 기록하지 않는다.

## Primary E2E Test Account

- AIMAX account: `demo@aimax.ai.kr`
- User id: `dfc795d4-5beb-47d2-bc85-7418b8864455`
- Purpose: Mac/Windows 설치 실행기 연결, 예리/현주/송이 회귀 테스트, 최소 유료 E2E 테스트
- Entitlement: bundle
- Latest verified Mac runner: `v1.0.17`
- Latest verified Mac connection: 2026-05-27 R3-M installed user-flow check
- Latest verified Windows runner: `v1.0.26`
- Latest verified Windows device label: `AIXLIFE (Windows)`
- Latest verified Windows connection: 2026-05-27 R3-K returned installer/webapp/runner evidence
- Local readiness on Windows: safe test login ready, runner/protocol/open-settings ready, update_required=false
- Server web AI/API secret status as of 2026-05-25: not yet imported
- Paid test policy: only bounded test flows, no automatic retry, no customer credentials
- Naver mutation policy: draft save only when explicitly approved; publish/schedule is not allowed by default

## Legacy/Archive Test Account

- AIMAX account: `aimax-regression-20260521@aimax.ai.kr`
- Purpose: earlier Windows E2E/regression checks
- Status: archive candidate; do not use as primary unless reconnected and reverified
- Last known Windows runner version in records: `v1.0.14`

## Operating Rule

Use `demo@aimax.ai.kr` as the default safe non-customer test account for AIMAX regression unless a phase document explicitly names another account. Always keep secrets out of docs, shared folders, screenshots, and terminal output.

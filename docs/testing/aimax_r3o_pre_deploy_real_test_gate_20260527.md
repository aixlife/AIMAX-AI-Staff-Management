# AIMAX R3-O Pre-Deploy Real Test Gate

작성: 2026-05-27

## 목적

앞으로 AIMAX 배포는 "빌드/스모크 통과"만으로 완료하지 않는다. 배포 직전 실제 사용자가 보는 웹 UI와 설치 실행기 기준으로 최소 1회 진짜 테스트를 통과해야 한다.

## 적용 대상

- live deploy
- Oracle version API 변경
- customer-facing installer rollout
- 예리/현주/송이/윤미 등 직원의 사용자-facing 흐름 변경
- paid 또는 credit-based 작업 흐름 변경

## 배포 전 필수 테스트

### 공통

- 실제 웹 UI에서 로그인
- 실제 사용자 흐름대로 버튼/폼을 사용
- 설치된 실행기 사용
- source mode, direct API, DOM patch, mock-only 테스트로 대체 금지
- 스크린샷 또는 visible text evidence 저장
- 계정, 플랫폼, 설치 버전, 선택 옵션, job/request id, 최종 상태 기록

### 예리 paid path

- 웹 UI에서 `300자` 옵션이 실제로 보여야 함
- `gemini-2.5-flash`
- 이미지 1장 이하
- 임시저장만 허용
- 발행/예약 금지
- 고객 계정/고객 자격증명 금지
- 자동 재시도 금지
- 기존 job/request 상태 확인 전 중복 제출 금지
- 비용 상한 500원

## 현재 R3 상태

- Mac/server source: 300자 옵션 추가 완료
- Mac no-paid contract: `YERI_WEB_USER_FLOW_CONTRACT_OK`
- Production web UI: 아직 300자 옵션 미배포
- Windows: R3-M/R3-N handoff 대기 중
- Paid real test: 아직 실행하지 않음. 운영 웹 UI가 300자 옵션을 실제로 노출한 뒤 별도 승인된 범위에서 1회 실행

## Stop Conditions

배포 전 아래 중 하나라도 발견되면 배포하지 않는다.

- 실제 UI에 300자 옵션이 보이지 않음
- 예리 폼이 비활성화됐는데 이유가 사용자에게 명확하지 않음
- 실행기 연결/버전/업데이트 상태가 웹 UI에서 다르게 보임
- job이 중복 생성되거나 기존 paid request를 재사용/확인하지 못함
- 발행/예약/고객 계정 사용 위험이 있음
- 오류 보고에 필요한 sanitized diagnostics가 빠짐

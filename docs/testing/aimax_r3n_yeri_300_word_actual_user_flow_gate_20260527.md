# AIMAX R3-N 예리 300자 실제 사용자 흐름 게이트

작성: 2026-05-27

## 목적

예리 최소 유료 테스트를 실제 사용자 기준으로 다시 정렬한다. Mac에서만 임시로 켜서 되는지가 아니라, 어떤 사용자 환경에서도 왜 막혔는지 설명되고, 웹 UI에서 300자 테스트를 자연스럽게 만들 수 있어야 한다.

## 발견한 문제

### 1. 예리 폼 비활성화 원인

웹 UI의 예리 폼은 아래 조건 중 하나라도 걸리면 전체 입력이 비활성화된다.

- 웹 계정이 실행 가능 상태가 아님
- 예리 권한이 없음
- 로컬 실행기가 연결되지 않음
- 현재 실행기가 필수 업데이트 대상임
- 연결된 실행기가 예리 worker를 제공하지 않음
- 로컬 실행기 설정에서 Naver 계정 또는 선택 AI 키가 준비되지 않음

관련 코드:

- `jobBlockReason(kind)`
- `setJobFormEnabled(config, enabled)`

이번 Mac 확인에서는 실행기 상태가 `disconnected`라서 예리 폼이 비활성화되었다. 작업 claim과 command 처리를 끈 heartbeat-only 상태로 연결만 확인했을 때 폼은 활성화되었다. 따라서 실제 배포 게이트에서는 "켰더니 됨"이 아니라, 각 환경에서 위 조건 중 무엇이 막고 있는지 증거를 남겨야 한다.

### 2. 300자 테스트 옵션 부재

운영 웹 UI의 예리 분량 선택지는 `800/1500/2500자`뿐이었다. 사용자가 요청한 최소 유료 테스트 기준인 `300자`를 실제 사용자처럼 실행하려면 UI에 `300자` 옵션이 있어야 한다.

## 변경

- `oracle/aimax-reports-api/static/app.html`
  - `#yeriWordCount`에 `300자` 옵션 추가
- `scripts/smoke_yeri_web_user_flow_contract.mjs`
  - 예리 300자 옵션 존재
  - 예리 제출 payload가 UI select의 word_count를 사용
  - 비활성화 이유가 agent connection을 설명
  - 폼 disabled 계약 유지
  - local agent target platform/device label 계약 유지

## 검증

```text
node scripts/smoke_yeri_web_user_flow_contract.mjs
YERI_WEB_USER_FLOW_CONTRACT_OK
```

## 유료 테스트 기준 수정

다음 유료 테스트는 아래 범위에서만 진행한다.

- 실제 웹 UI에서 생성
- 테스트 계정: `demo@aimax.ai.kr`
- 글 길이: `300자`
- 이미지: `1장 이하`
- AI 모델: `gemini-2.5-flash`
- 발행 방식: `임시 저장`
- Naver 계정: 테스트/검증용 계정만
- 발행/예약: 금지
- 고객 계정/고객 자격증명: 금지
- 자동 재시도: 금지
- 기존 job/request 상태 확인 전 중복 제출 금지
- 예상 비용 상한: 500원

## 현재 결정

운영 웹 UI에는 아직 300자 옵션이 배포되어 있지 않다. 따라서 지금 운영에서 300자 유료 테스트를 API 직접 호출이나 DOM 조작으로 진행하면 "실제 사용자 흐름"이 아니다.

다음 순서가 맞다.

1. Mac/server no-paid 검증 완료
2. Windows에 300자 UI 옵션과 비활성화 원인 확인 기준 전달
3. 양쪽 통과 후 배포 승인 게이트에서 웹 UI 변경 배포
4. 운영 웹 UI에서 300자 옵션이 보이는 상태로 최소 유료 draft-save 테스트 1회 실행

## 배포 전 필수 게이트

이후 AIMAX 배포는 아래 실제 테스트를 통과하기 전까지 완료로 보지 않는다.

- 실제 웹 UI에서 작업 생성
- 설치된 실행기 사용
- 300자 옵션이 사용자에게 실제로 보임
- `gemini-2.5-flash`, 이미지 1장 이하, 임시저장만 사용
- job/request id, 스크린샷, 실행기 버전, 플랫폼, 최종 상태, 비용 상한을 기록
- 발행/예약/고객 계정/고객 자격증명 사용 없음

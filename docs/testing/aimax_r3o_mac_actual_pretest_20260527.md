# AIMAX R3-O Mac Actual Pretest

작성: 2026-05-27

## 결론

Mac 실제 테스트는 아직 전체 통과가 아니다. 운영 웹 UI 로그인과 설치 실행기 연결 확인은 통과했지만, 운영 웹 UI에 `300자` 옵션이 아직 배포되어 있지 않아 유료 예리 job 생성 전 중지했다.

## 통과한 구간

- 계정: `demo@aimax.ai.kr`
- 운영 웹 UI: `https://api.aimax.ai.kr/app`
- Mac 설치 실행기: `/Applications/AIMAX.app`
- 실행기 연결 방식: heartbeat-only, job/command 실행 없음
- 웹 UI 표시:
  - agent status: `연결됨`
  - agent version: `v1.0.17`
  - platform: `macOS`
  - updates: `최신 상태`
  - current version: `v1.0.17`
- 기존 job 확인:
  - total jobs: `26`
  - open/risky jobs: `0`
  - status counts: `done=14`, `failed=12`
- 스크린샷:
  - `/private/tmp/aimax_actual_pretest_connected.png`

## 중지한 이유

운영 웹 UI HTML 확인 결과 `#yeriWordCount`는 아래 옵션만 노출하고 있다.

```text
800자
1500자
2500자
```

로컬 source에는 `300자` 옵션이 있지만, 운영 `/app`에는 아직 반영되지 않았다.

따라서 지금 유료 테스트를 진행하면 사용자가 요청한 `300자` 실제 사용자 플로우가 아니라 `800자 이상` 플로우가 된다. 또한 정상 agent polling 모드는 운영 job을 claim/execute할 수 있어, 별도 명시 승인 전에는 실행하지 않았다.

## 아직 미통과인 실제 사용자 흐름

- 실제 UI에서 `300자` 옵션 선택
- `gemini-2.5-flash`
- 이미지 `1장 이하`
- `임시 저장`
- 유료 글/이미지 생성
- Mac 실행기 정상 polling으로 job claim
- Naver 자동 로그인
- Smart Editor 제목/본문/이미지 삽입
- 임시저장 완료
- job id, 최종 상태, 비용, screenshot 기록

## 다음 선택지

1. 운영 배포 전 스테이징 실제 테스트:
   - localhost 또는 별도 staging page에서 `300자` 옵션이 있는 실제 UI를 열고 운영 API에 연결한다.
   - 정상 Mac agent polling을 켜서 job claim/임시저장까지 확인한다.
   - live `/app`나 Oracle version API는 변경하지 않는다.

2. 운영 UI에 `300자` 옵션을 먼저 배포한 뒤 실제 테스트:
   - 이 방법은 live UI 변경이므로 별도 배포 승인 필요.
   - 테스트 후 통과하지 못하면 즉시 후속 수정/롤백이 필요하다.

현재 상태에서는 1번이 더 안전하다.

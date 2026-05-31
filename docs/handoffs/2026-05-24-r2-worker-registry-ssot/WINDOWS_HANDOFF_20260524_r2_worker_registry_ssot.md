# Windows Handoff: R2 Worker Registry SSOT

> 작성: 2026-05-24 20:02 KST  
> 대상: Windows Codex / Windows 로컬 검증 환경  
> 목적: 운영 배포된 R2 직원/작업 카탈로그 계약이 Windows 웹앱/실행기 환경에서도 꼬이지 않는지 검증

## 먼저 읽을 것

프로젝트 작업 폴더에 이 문서가 단독으로 도착할 수 있으므로, 아래 요약만으로 검증 가능하게 작성한다.

Mac/server에서 완료된 작업:

- Oracle 운영 서버에 `server.js`, `static/app.html` 배포 완료.
- 배포 리포트: `docs/deployments/oracle-deploy-20260524-195946.md`
- R2 보고서: `docs/maintenance_reports/aimax_r2_worker_registry_ssot_20260524.md`
- 유료 API, Apify, Naver 저장/발행 테스트는 하지 않음.

## 핵심 변경

송이 자료조사원은 로컬 실행기 직원이 아니라 `web_module` 직원이다.

이번 배포에서 서버 카탈로그 계약은 아래처럼 정리됐다.

```text
songi_data_research
staff_code=songi
execution=web_module
job_kind=songi_research

songi_research
execution=web_module
api_mode=research_api
queue=false
```

의도:

- 송이는 웹/서버 연구 API로 실행한다.
- 송이가 `/api/jobs` 로컬 실행기 큐로 들어가면 안 된다.
- 예리/현주는 계속 로컬 실행기 필요 직원이다.

## Windows에서 확인할 것

1. 운영 웹앱 접속

```text
https://api.aimax.ai.kr/app
```

2. Windows 계정으로 로그인 후 기본 화면 확인

- 예리/현주가 로컬 실행기 필요 흐름으로 보이는지.
- 송이가 웹 자료조사원으로 보이는지.
- 윤미 권한이 있는 계정이라면 윤미가 웹 직원으로 보이는지.
- 나경/현성/상수 같은 준비 중 직원이 사용 가능한 직원처럼 오해되지 않는지.

3. 실행기 상태 확인

- Windows 실행기 v1.0.17 연결 상태.
- 실행기 연결/로컬 설정 화면이 무한 로딩되지 않는지.
- 이번 R2는 설치본 재빌드가 필수는 아니지만, 현재 Windows 설치본과 운영 웹앱이 함께 문제 없이 동작하는지 확인.

4. 카탈로그 확인

가능하면 브라우저 DevTools 또는 현재 로그인 세션을 사용해서 아래를 확인한다.

```text
GET https://api.aimax.ai.kr/api/workers
```

기대값:

```text
job_kinds includes:
  yeri_write      execution=local_agent api_mode=job_api queue=true
  hyunju_find     execution=local_agent api_mode=job_api queue=true
  songi_research  execution=web_module  api_mode=research_api queue=false

workers includes:
  yeri_writer          execution=local_agent
  hyunju_sales         execution=local_agent
  songi_data_research  execution=web_module job_kind=songi_research
```

5. 안전 차단 확인

가능하고 안전하다면, 송이가 `/api/jobs` 큐로 생성되지 않는지 확인한다. 단, 유료 작업이나 실제 발행/저장을 만들면 안 된다.

기대 에러:

```text
400
error=job_kind_uses_module_api
api_mode=research_api
```

## 금지

- 유료 AI 호출 금지.
- Apify paid run 금지.
- Naver 저장/발행/예약발행 테스트 금지.
- API keys, cookies, `.env`, 브라우저 프로필, signed URL, raw private logs를 shared folder에 넣지 말 것.
- shared folder 안에서 빌드하지 말 것. 필요한 경우 로컬 Windows 작업 폴더로 복사해서 작업.

## 반환할 것

아래 파일을 같은 공유 폴더에 작성해서 반환한다.

```text
WINDOWS_RESULT_20260524_r2_worker_registry_ssot.md
```

반환 내용:

- PASS / FAIL / BLOCKED
- Windows 실행기 버전
- 운영 웹앱 접속 결과
- `/api/workers` catalog 확인 결과
- 송이 `research_api queue=false` 확인 여부
- 예리/현주 `local_agent queue=true` 확인 여부
- 로컬 설정/실행기 연결 무한 로딩 여부
- 발견한 문제와 재현 단계
- 유료 API/Apify/Naver 호출을 하지 않았다는 확인

## Windows 판정 기준

PASS:

- 운영 웹앱이 Windows에서 정상 접속된다.
- 실행기 v1.0.17 연결 상태가 정상이다.
- 송이는 `web_module`, `research_api`, `queue=false`로 보인다.
- 예리/현주는 `local_agent`, `job_api`, `queue=true`로 보인다.
- 무한 로딩이나 잘못된 큐 제출이 없다.

FAIL:

- 송이가 로컬 실행기 큐 작업처럼 보이거나 `/api/jobs`로 생성된다.
- 예리/현주 로컬 실행기 흐름이 깨진다.
- 실행기 연결/설정 화면이 Windows에서 다시 무한 로딩된다.

BLOCKED:

- 로그인 계정/권한/네트워크 문제로 확인 불가.
- 단, 재현 불가를 PASS로 처리하지 말 것.

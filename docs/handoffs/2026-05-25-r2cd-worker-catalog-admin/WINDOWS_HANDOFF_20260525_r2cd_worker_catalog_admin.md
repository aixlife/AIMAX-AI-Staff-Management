# Windows Handoff: R2-C/D Worker Catalog Admin

> 작성: 2026-05-25 00:30 KST  
> 대상: Windows Codex / Windows 로컬 검증 환경  
> 목적: 운영 배포된 R2-C/D 웹 카탈로그 서버 우선화와 admin 직원 카탈로그 표시를 Windows 환경에서 검증

## 배경

Mac/server에서 R2-C/D를 구현하고 Oracle 운영 서버에 배포했다.

배포 리포트:

`docs/deployments/oracle-deploy-20260525-002511.md`

R2-C/D 보고서:

`docs/maintenance_reports/aimax_r2cd_worker_catalog_admin_20260525.md`

## 변경 핵심

### 사용자 웹앱

`/api/workers` catalog를 받은 뒤에는 서버에 없는 fallback 직원/작업을 제거한다.

목표:

- 서버가 실제 기준이다.
- 웹에 오래된 fallback 직원/작업이 남아 사용 가능한 것처럼 보이지 않는다.
- `/api/workers` 실패 시에만 fallback이 남는다.

### Admin

`/api/admin/catalog`의 `workers`, `job_kinds`를 이용해 구매자 운영 탭에 `직원 카탈로그` 섹션을 추가했다.

운영자가 확인해야 하는 정보:

- 직원명/역할
- `로컬 실행기`, `웹 실행`, `준비 중`
- 상품
- API mode
- 큐 사용 여부
- 연결된 job kind

### Server

송이 상품의 admin product catalog에 `songi_research`를 연결했다.

## Windows 검증 항목

1. 운영 웹앱

```text
https://api.aimax.ai.kr/app
```

확인:

- 로그인 후 화면이 무한 로딩되지 않는다.
- 예리/현주는 로컬 실행기 기반 직원으로 보인다.
- 송이는 웹 자료조사원으로 보인다.
- 윤미 권한이 있는 계정이면 윤미가 웹 직원으로 보인다.
- 준비 중 직원이 사용 가능한 직원처럼 오해되지 않는다.

2. 운영 admin

```text
https://api.aimax.ai.kr/admin
```

확인:

- HTML 또는 화면에 `직원 카탈로그` 섹션이 있다.
- 가능하면 관리자 로그인 후 실제 섹션 렌더를 확인한다.
- 기대 요약: 직원 7명, 작업 4개, 로컬 2, 웹 2.
- 송이 카드에 `웹 실행`, `research_api`, `큐 아님`, `songi_research`가 보인다.
- 예리/현주 카드에 `로컬 실행기`, `job_api`, `큐 사용`이 보인다.
- 윤미 카드가 보이면 `웹 실행`, `job_api`, `큐 사용`, `yunmi_script`로 보인다.

3. Catalog API

로그인 세션으로 가능하면:

```text
GET https://api.aimax.ai.kr/api/workers
```

기대값:

```text
songi_research  execution=web_module  api_mode=research_api queue=false
yeri_write      execution=local_agent api_mode=job_api      queue=true
hyunju_find     execution=local_agent api_mode=job_api      queue=true
```

관리자 세션으로 가능하면:

```text
GET https://api.aimax.ai.kr/api/admin/catalog
```

기대값:

```text
products.songi.job_kinds includes songi_research
workers includes songi_data_research
job_kinds includes songi_research, yunmi_script, yeri_write, hyunju_find
```

## 금지

- 유료 AI 호출 금지.
- Apify paid run 금지.
- Naver 저장/발행/예약발행 테스트 금지.
- API keys, cookies, `.env`, 브라우저 프로필, signed URL, raw private logs를 shared folder에 넣지 말 것.
- shared folder 안에서 빌드하지 말 것.

## 반환할 것

같은 공유 폴더에 아래 파일 작성:

```text
WINDOWS_RESULT_20260525_r2cd_worker_catalog_admin.md
```

반환 내용:

- PASS / FAIL / BLOCKED
- Windows 실행기 버전
- 운영 웹앱 `/app` 확인 결과
- 운영 admin `/admin` 직원 카탈로그 표시 결과
- `/api/workers` catalog 확인 결과
- `/api/admin/catalog` 확인 결과, 가능할 경우
- 문제/재현 단계
- 유료 API/Apify/Naver 호출을 하지 않았다는 확인

## 판정 기준

PASS:

- 사용자 웹앱이 서버 catalog 기준으로 정상 렌더된다.
- admin에 `직원 카탈로그` 섹션이 보인다.
- 송이/예리/현주 계약이 기대값과 같다.
- Windows 실행기 연결 흐름에 새 회귀가 없다.

FAIL:

- 웹 fallback이 서버에 없는 직원/작업을 사용 가능한 것처럼 남긴다.
- admin 직원 카탈로그가 보이지 않거나 송이 작업 연결이 누락된다.
- Windows에서 새 무한 로딩 또는 실행기 연결 회귀가 발생한다.

BLOCKED:

- 관리자 인증/권한/네트워크 문제로 확인 불가.
- 재현 불가를 PASS로 처리하지 말 것.

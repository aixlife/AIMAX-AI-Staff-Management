# AIMAX 전체 코드베이스 구조 분석 및 문제 진단 보고서

작성일: 2026-05-23  
분석자: Claude Sonnet 4.6  
분석 방법: 전체 소스 코드 직접 읽기 + 웹검색 교차 검증

---

## 1. 시스템 전체 구조 한 눈에 보기

```
┌─────────────────────────────────────────────────────────┐
│                 AIMAX 전체 아키텍처                        │
│                                                          │
│  ┌──────────────────┐    ┌──────────────────────────────┐│
│  │ 로컬 실행기 (Mac/Win) │    │   서버 (oracle/aimax-reports-api) ││
│  │  app.py (5,416줄) │◄──►│   server.js (8,081줄)        ││
│  │  Tkinter GUI     │    │   단일 파일 Node.js 서버       ││
│  │  HeadlessAgent   │    │                              ││
│  └──────────────────┘    │  ┌──────────────────────┐   ││
│                          │  │ static/admin.html     │   ││
│  ┌──────────────────┐    │  │ (2,161줄)             │   ││
│  │  web_agent/      │    │  ├──────────────────────┤   ││
│  │  client.py       │    │  │ static/app.html       │   ││
│  │  (API 클라이언트) │    │  │ (8,804줄)             │   ││
│  └──────────────────┘    │  └──────────────────────┘   ││
│                          └──────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
      합계: 소스 파일 24,462줄이 사실상 4개 파일에 몰려 있음
```

---

## 2. 직원(Worker) 현황 전체 정리

| 직원 | staffCode | jobKind | execution | product | 상태 |
|------|-----------|---------|-----------|---------|------|
| 예리 | yeri | yeri_write | **local_agent** | yeri | ✅ 작동 (로컬만) |
| 현주 | hyunju | hyunju_find | **local_agent** | hyunju | ✅ 작동 (로컬만) |
| 윤미 | yunmi | yunmi_script | **web_module** | bundle | ⚠️ 베타 (접근 제한) |
| 송이 | songi | - | **web_module** | songi | ⚠️ 작동하지만 research 기능만 |
| 나경 | nakyung | -(없음) | **planned** | bundle | ❌ 미구현 |
| 현성 | hyunseong | -(없음) | **planned** | bundle | ❌ 미구현 |
| 상수 | sangsu | -(없음) | **planned** | bundle | ❌ 미구현 |

**실제로 웹앱에서 명령을 내릴 수 있는 직원: 예리, 현주 2명뿐**  
나머지 5명은 "기능 준비 중" 껍데기 상태

---

## 3. 윤미 Admin 버튼이 없는 이유 — 정확한 원인

### 현재 구조

```javascript
// server.js:3940 — yunmi 접근 판단 로직
function canAccessYunmi(user) {
  if (YUNMI_PUBLIC_ENABLED) return true;   // 환경변수로만 전체 공개
  return userAccessIdentifierVariants(user)
    .some((id) => YUNMI_ALLOWED_USER_IDENTIFIERS.has(id));
    // 하드코딩된 이메일 목록으로만 허용
}

// server.js:43 — 기본 허용 목록
const YUNMI_DEFAULT_ALLOWED_USERS = [
  "demo@aimax.ai.kr",
  "AIMAX Demo",
  "메이크패밀리 1", "메이크패밀리1",
  "메이크패밀리 2", "메이크패밀리2",
];
```

### 문제점

- `yunmi_access`는 계산값(`canAccessYunmi()`)이며, **DB에 저장되는 필드가 아님**
- Admin API에 윤미 접근 권한을 변경하는 엔드포인트가 **존재하지 않음**
- Admin HTML에 윤미 토글 버튼이 **없음** (전체 코드 검색 결과 0건)
- `users.json` 파일의 user 객체에 `yunmi_access` 필드 저장 구조 자체가 없음
- 현재 방법: 서버 환경변수 `AIMAX_YUNMI_ALLOWED_USERS`에 이메일 추가하거나 `AIMAX_YUNMI_PUBLIC_ENABLED=1`로만 허용 가능 (서버 재시작 필요)

**결론: 윤미 버튼은 설계 자체에 없다. 누군가 넣었다고 했다면 착각이거나 기획에만 있었던 것.**

---

## 4. 구조적 문제 전체 목록

### 🔴 Critical — 운영 직접 영향

#### 문제 1: 단일 파일 집중 (God File 문제)

- `server.js` 8,081줄 = 인증 + 사용자 관리 + job 처리 + 윤미 스크립트 + 송이 리서치 + 카페24 + 오류보고 + 파일 저장 + 이메일 + 텔레그램 알림이 전부 한 파일
- `app.py` 5,416줄 = Tkinter UI + 설정 저장 + keyring + 브라우저 자동화 + 글쓰기 + 이웃찾기 + 에이전트 폴링이 전부 한 파일
- **영향**: 버그 한 개 수정이 다른 기능에 영향을 줄 수 있음. 협업 시 merge 충돌 상시 발생

#### 문제 2: 데이터 저장이 JSON 파일 기반

```
DATA_DIR/
  users.json          — 전체 사용자 데이터
  sessions.json       — 세션 토큰
  jobs.json           — 작업 큐
  agents.json         — 에이전트 상태
  agent-commands.json — 명령 큐
  cafe24-orders.json  — 주문 데이터
  user-secrets.json   — 암호화된 API 키
  research.json       — 리서치 데이터
```

- 동시 쓰기 시 데이터 유실/충돌 위험 (Node.js 단일 스레드라 어느 정도 보호되나 완전하지 않음)
- 백업/복구 전략 없음
- 데이터가 커질수록 전체 파일 로드/저장으로 성능 저하

#### 문제 3: 윤미 접근 권한 관리 누락

- Admin에서 개별 사용자에게 윤미 권한을 줄 수 없음
- 현재는 서버 재시작 없이 `AIMAX_YUNMI_ALLOWED_USERS` 환경변수 변경이 적용 안 됨
- 권한 변경 = 운영자가 서버에 직접 접속해서 환경변수 수정 후 재시작해야 함

---

### 🟠 High — 기능 완성도 문제

#### 문제 4: 5명의 직원이 껍데기

```javascript
// nakyung, hyunseong, sangsu 모두 동일
execution: "planned",
type: "planned",
status: "needs_setup",
jobKind: "",  // 빈 문자열 — 실행 불가
```

- 웹앱 UI에 직원 카드로 보이지만 클릭해도 실제 기능 없음
- 사용자 혼란 야기

#### 문제 5: 윤미 requiredProduct와 접근 제어 불일치

```javascript
// server.js:309
yunmi_script: {
  requiredProduct: "bundle",  // bundle 이어야만 가능
  workerCode: "yunmi_script_writer",
}
// 하지만 canAccessYunmi()는 product 체크가 아닌 whitelist 체크
```

- bundle 상품을 가진 사용자라도 whitelist에 없으면 윤미를 못 쓰는 이중 제한
- 반대로 whitelist에 있어도 bundle이 없으면 JOB 생성 불가

#### 문제 6: 플랫폼 명령 라우팅 불안정

- Mac/Windows가 같은 계정을 쓸 때 `user_id` 기준으로만 에이전트 저장 → 플랫폼 상태 혼용 가능
- 이는 최신 handoff(2026-05-23)에서도 미해결 상태로 Windows 검증 중
- Mac 대상 명령을 Windows가 받을 수 있는 구조적 결함

---

### 🟡 Medium — 유지보수 문제

#### 문제 7: split_version과 메인 app.py 이중 유지

```
app.py                     — 메인 (전체 모드)
split_version/app.py       — 분리 버전 (기능 서브셋)
split_version/app_write.py
split_version/app_engage.py
split_version/app_find.py
```

- 두 버전이 병렬 존재 → 변경 시 두 곳 다 수정 필요 → 누락 발생
- 어느 것이 배포 기준인지 명확하지 않음

#### 문제 8: handoff 디렉토리 이중 존재

```
handoff/   (구 — 일부 파일만 존재)
handoffs/  (신 — 최신 작업 문서)
```

- 두 개의 handoff 디렉토리 존재
- 최신 source file들이 여러 handoff 폴더에 분산되어 어느 게 최신인지 추적 어려움
- 수작업 zip 전달 기반 배포 → Windows/Mac 간 소스 불일치 상시 위험

#### 문제 9: 서버 환경변수 40개+, 관리 문서 없음

주요 환경변수 목록 (누락 시 기능이 조용히 꺼짐):

| 환경변수 | 용도 |
|---------|------|
| `AIMAX_ADMIN_PASSWORD` | Admin 로그인 |
| `AIMAX_REPORT_TOKEN` | 오류 보고 인증 |
| `AIMAX_CAFE24_WEBHOOK_SECRET` | 카페24 연동 |
| `AIMAX_RESEND_API_KEY` | 이메일 발송 |
| `AIMAX_TELEGRAM_BOT_TOKEN` | 텔레그램 알림 |
| `AIMAX_YUNMI_ALLOWED_USERS` | 윤미 접근 허용 목록 |
| `AIMAX_YUNMI_PUBLIC_ENABLED` | 윤미 전체 공개 여부 |
| `AIMAX_LATEST_AGENT_VERSION` | 최신 에이전트 버전 |
| `AIMAX_WINDOWS_LATEST_AGENT_VERSION` | Windows 최신 버전 |
| ... (30개 이상 추가) | |

- `.env.example` 정비 상태 미확인
- 어떤 값이 없을 때 어떤 기능이 꺼지는지 문서 없음

---

## 5. 현재 운영 가능한 기능 vs 불가능한 기능

| 기능 | 현재 상태 | 이유 |
|------|-----------|------|
| 예리 블로그 글쓰기 (로컬 실행기) | ✅ 작동 | local_agent, yeri_write 완성 |
| 현주 이웃찾기 (로컬 실행기) | ✅ 작동 | local_agent, hyunju_find 완성 |
| 송이 리서치 | ⚠️ 부분 작동 | web_module, Apify 키 필요 |
| 윤미 스크립트 (알파) | ⚠️ whitelist만 | bundle 상품 + 허용 이메일 필요 |
| 윤미 스크립트 (AI 베타) | ⚠️ mock 상태 | 유료 AI 호출 아직 미연결 |
| 나경/현성/상수 | ❌ 없음 | planned 상태, jobKind 없음 |
| Admin 윤미 권한 토글 | ❌ 없음 | 설계 누락 |
| 웹앱에서 예리/현주 직접 실행 | ✅ 작동 | job → local_agent polling |
| 카페24 주문 처리 | ✅ 작동 | admin.html 구현됨 |
| 오류 보고 관리 | ✅ 작동 | admin.html 구현됨 |

---

## 6. 왜 "이대로 가면 운영이 안 되는가" — 핵심 요약

```
현재 상태:
┌──────────────────────────────────────────────────────┐
│ 문제의 본질: 아키텍처 없이 기능을 쌓아온 구조        │
│                                                      │
│ 1. 코드 집중: 8,000+줄 단일 파일 서버               │
│              → 버그 수정 = 전체 시스템 위험         │
│                                                      │
│ 2. 데이터 취약: JSON 파일 DB                        │
│              → 동시 접속 증가시 데이터 손상 위험     │
│                                                      │
│ 3. 접근 제어 누락: yunmi whitelist 방식             │
│              → Admin이 사용자 권한 관리 불가         │
│                                                      │
│ 4. 미완성 직원 5명이 UI에 노출됨                    │
│              → 사용자 신뢰 저하                     │
│                                                      │
│ 5. 이중 소스: app.py + split_version/app.py         │
│              → 변경 누락, 버전 불일치               │
│                                                      │
│ 6. Handoff 기반 배포: 수작업 zip 전달 방식          │
│              → Windows/Mac 간 소스 불일치 상시 위험  │
└──────────────────────────────────────────────────────┘
```

---

## 7. 재설계 시 우선순위 권장 (분석 결과 기준)

### 즉시 — 운영 가능하게 (코드 수정 최소)

1. **윤미 Admin 버튼 추가**
   - `server.js`에 `/api/admin/users/set-yunmi-access` 엔드포인트 추가
   - `users.json` user 객체에 `yunmi_access_override` 필드 저장 구조 추가
   - `admin.html` 구매자 목록 행에 "윤미 허용/해제" 토글 버튼 1개 추가
   - `canAccessYunmi()`가 저장된 override도 확인하도록 수정

2. **미완성 직원 명확히 구분 표시**
   - `type: "planned"` 직원은 "준비 중" 배지 + 클릭 비활성화 또는 안내 팝업
   - 현재 완성된 직원과 동등하게 노출되어 사용자 혼란 야기

### 중기 — 구조 안정화

3. `server.js`를 기능 단위 모듈로 분리
   - `routes/auth.js`, `routes/users.js`, `routes/jobs.js`, `routes/workers.js`, `routes/admin.js`, `routes/integrations.js`

4. JSON 파일 DB → SQLite 또는 Supabase 전환
   - 특히 `users.json`, `sessions.json`, `jobs.json`은 동시 접근 위험이 가장 큼

5. 환경변수 설정 문서화 및 `.env.example` 정비
   - 어떤 변수가 없을 때 어떤 기능이 꺼지는지 명시

### 장기 — 확장 가능한 구조

6. 직원(Worker) 시스템을 플러그인 구조로 전환
   - 새 직원 추가 시 `server.js` 손대지 않고 별도 모듈만 추가

7. 로컬 실행기와 웹 모듈의 job 처리 통일된 인터페이스

8. 수작업 zip handoff → Git 기반 배포 파이프라인으로 전환
   - Windows/Mac 소스 불일치 문제 근본 해결

---

## 8. 분석 근거 파일 목록

| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `app.py` | 5,416 | 로컬 실행기 메인 (Tkinter + Agent) |
| `oracle/aimax-reports-api/server.js` | 8,081 | 백엔드 서버 전체 |
| `oracle/aimax-reports-api/static/admin.html` | 2,161 | 운영자 어드민 UI |
| `oracle/aimax-reports-api/static/app.html` | 8,804 | 사용자 웹앱 UI |
| `web_agent/client.py` | 393 | 서버 API 클라이언트 |
| `local_agent/runtime.py` | 100+ | 헤드리스 에이전트 어댑터 |
| `split_version/app.py` | - | 분리 버전 (병렬 유지 중) |

---

*이 문서는 2026-05-23 기준 코드베이스 상태를 분석한 것입니다. 코드 수정 없이 분석만 수행했습니다.*

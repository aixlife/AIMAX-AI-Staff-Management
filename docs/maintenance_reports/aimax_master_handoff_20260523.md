# AIMAX Master Handoff Document
> 작성일: 2026-05-23  
> 목적: 4개 AI 교차검증 종합 + Phase 실행 계획 + 다음 AI에게 전달하는 컨텍스트 완전 패키지  
> 작성자: Claude (Sonnet 4.6) — 교차검증 종합 역할  
> 수신자: 다음 실행 담당 AI (Codex / Gemini / Claude / 기타)

---

## 2026-05-23 Mac Codex 정정

이 문서의 일부 표현은 작성 당시 기준이다. 이후 운영 배포와 post-deploy verification이 완료되었으므로, 다음 실행 기준은 아래 문서를 우선한다.

- `docs/maintenance_reports/aimax_cross_environment_phase_plan_20260523.md`
- `docs/deployments/oracle-deploy-20260523-051021.md`

특히 "Windows AI"는 별도 AI가 아니라 **Windows 환경의 Codex**로 본다. MacBook 환경에는 Codex, Claude Code, Antigravity가 있고, Windows 검증/빌드는 Windows PC의 Codex가 담당한다.

---

## 0. 이 문서를 받은 AI에게

이 문서는 AIMAX 전체 코드베이스 분석과 4개 AI 보고서 교차검증을 완료한 뒤 작성된 실행 핸드오프입니다.

**반드시 먼저 읽어야 하는 파일들:**

```
[Antigravity - 비즈니스-기술 융합]
~/.gemini/antigravity/brain/27a27ab7-cf5a-4af4-8fa4-344603ce17c9/aimax_synthesis_strategy_report.md
~/.gemini/antigravity/brain/27a27ab7-cf5a-4af4-8fa4-344603ce17c9/aimax_ultimate_reliability_masterplan.md
~/.gemini/antigravity/brain/27a27ab7-cf5a-4af4-8fa4-344603ce17c9/aimax_architecture_analysis_report.md

[실제 진행 상태 - 최우선 확인]
docs/ai_staff_rephase_20260523.md  ← Phase 0~4 완료 현황 (배포 대기 목록)

[교차 검증 프로토콜]
docs/CROSS_VERIFICATION.md
docs/AI_COUNCIL_OPINIONS.md

[분석 보고서]
docs/maintenance_reports/aimax_current_code_independent_audit_20260523.md  ← Codex 독립 감사
docs/maintenance_reports/aimax_architecture_reset_20260523.md               ← AI Council (운영 데이터)
docs/maintenance_reports/aimax_final_cross_platform_employee_system_opinion_20260523.md
docs/aimax_v2_redesign_architecture_20260523.md                             ← Claude v2 재설계
AIMAX_ARCHITECTURE_ANALYSIS_20260523.md                                     ← Claude 코드 분석
```

**이 문서의 역할:**  
위 문서들을 읽지 않아도 다음 단계를 실행할 수 있도록 모든 결정사항과 컨텍스트를 담았습니다. 단, 코드 레벨 작업 시 원본 파일을 직접 참조하세요.

---

## ⚡ 긴급 공지 — 이 문서를 받은 AI에게 (최우선 읽기)

**Phase 0~4가 이미 완료되어 배포 대기 중입니다.**  
`docs/ai_staff_rephase_20260523.md` 확인 결과:

| Phase | 내용 | Mac/Server/Web | Windows | Live 배포 |
|-------|------|---------------|---------|----------|
| 0 | Yunmi Alpha | ✅ 완료 | ✅ 완료 | ⏳ 별도 판단 |
| 1 | Local Key Import Bridge | ✅ 완료 | ✅ 완료 (installer 빌드됨) | ⏳ 미배포 |
| 2 | Songi Web-First 안정화 | ✅ 완료 | - | ⏳ 미배포 |
| 3 | Yunmi Paid-Ready Beta | ✅ 완료 | ✅ 완료 (installer 빌드됨) | ⏳ 미배포 |
| 4 | Windows Release Lane | - | ✅ 완료 | ⏳ Live 교체 미완 |
| 5 | 나경/현성/상수 | 미시작 | 미시작 | - |

**Windows 배포 대기 파일:**
- Phase 1: `aimax-bundle-windows.exe` SHA256 `4579889c...`
- Phase 3: `aimax-bundle-windows.exe` SHA256 `1aa21356...` / ZIP `AIMAX-yunmi-paid-ready-windows-20260523.zip`

**→ 지금 당장 해야 할 일은 새 코드 작성이 아니라 완성된 것을 Live 서버에 배포하는 것입니다.**

---

## 1. 프로젝트 현황 (2026-05-23)

### 1-1. AIMAX란

사용자가 AI 직원에게 작업을 지시하는 SaaS 서비스.  
- **웹앱**: `oracle/aimax-reports-api/static/app.html` (8,804줄) — 사용자 인터페이스
- **서버**: `oracle/aimax-reports-api/server.js` (8,081줄) — 단일 파일에 모든 로직
- **로컬 실행기 macOS**: `app.py` (5,416줄) — Tkinter GUI + 네이버 브라우저 자동화
- **로컬 실행기 Windows**: `split_version/app.py` — macOS 버전 수작업 포크
- **헤드리스 어댑터**: `local_agent/runtime.py` (914줄)
- **API 클라이언트**: `web_agent/client.py` (393줄)

### 1-2. 직원 목록 및 실행 방식

| 직원 | 역할 | 현재 실행 방식 | 목표 실행 방식 |
|------|------|--------------|--------------|
| 예리 | 네이버 블로그 글쓰기 | local_agent (전체) | **hybrid** (서버 생성 + 로컬 입력) |
| 현주 | 네이버 서로이웃/영업 | local_agent | local-agent-required (유지) |
| 윤미 | 스크립트 작가 | web_module (beta) | **web-first** (접근 제어 개선) |
| 송이 | 자료조사 | web_module | **web-first** (로컬 의존 제거) |
| 나경/현성/상수 | 미정 | planned | **완전 숨김** (실제 job kind 생기기 전까지) |

### 1-3. 운영 데이터 (2026-05-23 기준, Architecture Reset에서)

```
활성 사용자: 165명 (비밀번호 변경 필요: 104명)
에이전트 등록: 39개, 15분 내 활성: 6개, 1시간 내: 7개, 1일 내: 13개

7일간 작업:
- hyunju_find:done    123건  ← 현주는 잘 작동함
- yeri_write:failed    62건  ← 예리 실패율 85%
- yeri_write:done      11건

예리 실패 원인 분류:
- unknown/other: 30건
- content_generation: 12건  ← AI API 키 문제
- local_key_missing: 9건    ← 로컬 키 없음
- editor_contract: 8건      ← 네이버 에디터 연결 실패
- browser_driver: 2건
- editor_input: 1건

7일간 오류 보고 22건:
- Windows: 21건  ← 사실상 Windows가 메인 플랫폼
- macOS: 1건
- setup/key/token 계열: 18건
```

**가장 중요한 사실**: Windows 사용자가 대부분이며, 예리 실패의 핵심 원인은 API 키 경로 혼선입니다.

---

## 2. 근본 원인 (4개 AI 전원 동의)

### 2-1. API 키 단절 (최우선 수리 대상)

```
사용자가 웹에서 저장하는 위치: server.js user-secrets.json (AES-GCM 암호화)
로컬 실행기가 읽는 위치:       keyring → fallback .settings_secrets.json (평문)

→ 사용자는 "저장했다"고 믿지만 실행기는 다른 곳을 읽음
→ yeri_write:failed 62건 중 local_key_missing 9건 + content_generation 12건의 직접 원인
```

### 2-2. 직원 정의 이중화

```
server.js WORKERS 객체 (line 165) ─┐
server.js JOB_KINDS (line 298)     │ → 3곳이 항상 일치해야 하지만 자주 어긋남
app.html jobKinds 하드코딩 (line 3302) ┘

구체적 불일치 사례:
- songi_research: app.html에는 있음, server.js JOB_KINDS에 없음
- yunmi_script: 서버 JOB_KINDS에 있음, 로컬 실행기 _worker_remote_job()에서 ValueError
```

### 2-3. 윤미 접근 제어 하드코딩

```javascript
// server.js line 3940 (현재)
function canAccessYunmi(user) {
  const whitelist = ['hardcoded@email.com'];  // DB 아님
  return whitelist.includes(user.email);
}
// admin.html에 토글 버튼 없음 (코드 확인됨)
```

### 2-4. macOS/Windows 코드 이중화

```
app.py (macOS) ←→ split_version/app.py (Windows)
→ 수작업 sync, 한쪽 고치면 다른 쪽 반영 안 됨
→ 21/22 오류 보고가 Windows에서 나오는 이유
```

### 2-5. 로컬 설정 저장 시 API 키 삭제 버그

```
현재: 로컬 설정 창에서 저장 시 provider API 키가 비워짐
→ 사용자가 설정을 바꾸다가 기존 키가 사라지는 현상
→ Architecture Reset에서 패치 완료 (미배포 상태)
```

---

## 3. 설계 원칙 (4개 AI 전원 동의)

### 3-1. 핵심 3원칙

```
1. 직원 = 서버가 정의한다 (Single Source of Truth)
2. 로컬 앱 = 네이버 브라우저 조작만 한다
3. UI = 지금 할 수 있는 것만 보인다
```

### 3-2. 비밀값 분리 원칙 (Architecture Reset 선언)

```
네이버 ID / 비밀번호 / 세션  →  로컬 전용 (서버로 절대 올리지 않음)
Gemini / OpenAI / Claude / Apify API 키  →  웹 암호화 저장 기준
```

이 두 가지를 같은 설정 화면에 섞으면 안 됩니다.

### 3-3. 직원 실행 방식 분류

```
web-first: 서버/웹만으로 실행 가능 (송이, 윤미)
local-agent-required: 네이버 브라우저 자동화 필수 (현주)
hybrid: 서버가 생성 → 로컬이 네이버 입력만 (예리 목표 구조)
```

### 3-4. 크로스플랫폼 구조

```
공통 코어 (Mac/Windows 동일):
- agent heartbeat
- command polling
- job execution protocol
- browser automation interface
- error/report payload

플랫폼 어댑터 (분리):
- macOS: Keychain, AppleScript, installer
- Windows: Credential Manager, COM, installer
```

---

## 4. v2 목표 아키텍처

### 4-1. 파일 구조

```
oracle/aimax-reports-api/
├── server.js                    # 진입점만 (200줄 이하)
├── modules/
│   ├── workers.js               # 직원 정의 + catalog API
│   ├── jobs.js                  # 큐 관리
│   ├── vault.js                 # API 키 암호화 저장
│   ├── auth.js                  # 로그인 + 세션
│   └── admin.js                 # 권한 관리
├── data/
│   ├── users.json
│   ├── jobs.json
│   └── workers.json             # 직원 정의 SSOT ← 새로 추가
└── static/
    ├── app.html
    └── admin.html

local_runner/                    # 신규 (Mac/Windows 공통)
├── runner.py                    # 진입점
├── core/
│   ├── poller.py                # Job polling
│   ├── executor.py              # 작업 라우터
│   └── session.py               # 서버 인증
├── workers/
│   ├── yeri.py
│   └── hyunju.py
├── platform/
│   ├── __init__.py              # OS 감지
│   ├── mac.py                   # macOS 전용
│   └── windows.py               # Windows 전용
└── ui/
    ├── tray_mac.py
    └── tray_win.py
```

### 4-2. workers.json 스키마 (SSOT)

```json
{
  "yeri": {
    "id": "yeri",
    "name": "예리",
    "role": "네이버 블로그 글쓰기",
    "execution": "hybrid",
    "job_kinds": ["yeri_write"],
    "requires_local": true,
    "icon": "✍️",
    "enabled": true,
    "visibility": "public"
  },
  "hyunju": {
    "id": "hyunju",
    "name": "현주",
    "role": "네이버 서로이웃/영업",
    "execution": "local-agent-required",
    "job_kinds": ["hyunju_find"],
    "requires_local": true,
    "icon": "🔍",
    "enabled": true,
    "visibility": "public"
  },
  "yunmi": {
    "id": "yunmi",
    "name": "윤미",
    "role": "스크립트 작가",
    "execution": "web-first",
    "job_kinds": ["yunmi_script"],
    "requires_local": false,
    "access_controlled": true,
    "icon": "⚙️",
    "enabled": true,
    "visibility": "access_controlled"
  },
  "songi": {
    "id": "songi",
    "name": "송이",
    "role": "자료조사원",
    "execution": "web-first",
    "job_kinds": ["songi_research"],
    "requires_local": false,
    "icon": "📊",
    "enabled": true,
    "visibility": "public"
  },
  "nageong": {
    "id": "nageong",
    "name": "나경",
    "execution": "planned",
    "enabled": false,
    "visibility": "hidden"
  }
}
```

### 4-3. users.json 스키마 v2

```json
{
  "userId": "abc123",
  "email": "user@example.com",
  "name": "민수",
  "plan": "pro",
  "workers": {
    "yeri": true,
    "hyunju": true,
    "yunmi": false,
    "songi": true
  },
  "created_at": "2026-01-01"
}
```

### 4-4. 예리 hybrid job 흐름

```
[웹앱] 키워드 입력 → 시작 버튼
  ↓
[서버] yeri_write job 생성 (status: generating)
  ↓
[서버] AI API로 글 생성 → 이미지 생성
  ↓
[서버] artifact 저장 (job payload에 포함)
  job.payload = { draft: "...", images: [...], generated_at: "..." }
  ↓
[서버] status: ready_for_publish
  ↓
[로컬 실행기] polling → job 발견
  ↓
[로컬] artifact 가져오기 (새 AI 비용 없음)
  ↓
[로컬] 네이버 로그인 → 에디터 열기 → 글/이미지 입력 → 발행
  ↓
[서버] status: done

재시도 시:
- 글 생성 단계 실패 → 처음부터
- 네이버 입력 단계 실패 → artifact 재사용, AI 비용 없이 재시도
```

### 4-5. UI 표시 조건

| 직원 | 표시 조건 |
|------|----------|
| 예리 | 로컬 연결 + `workers.yeri: true` |
| 현주 | 로컬 연결 + `workers.hyunju: true` |
| 윤미 | `workers.yunmi: true` (로컬 불필요) |
| 송이 | `workers.songi: true` (로컬 불필요) |
| 나경 외 | 완전 미표시 |

---

## 4-B. Antigravity 단독 기여 (다른 AI가 놓친 내용)

### 4-B-1. 비즈니스-기술 충돌 경고 (Synthesis Report)

다른 AI들은 기술 구조만 분석했지만, Antigravity만 **비즈니스 맥락**을 연결했습니다:

```
비즈니스 플랜: 3만원 NFC/QR 굿즈 → 오프라인 세미나 → 159만원 멤버십 (월 1억 목표)
기술 현실: 대량 유입 시 JSON DB 동시 쓰기 충돌 → 유료 회원 계정 영구 삭제 가능
```

**결론**: 마케팅 퍼널 가동 전 SQLite 이전이 비즈니스 생존 조건입니다.

### 4-B-2. OS Abstraction Bridge (가장 상세한 크로스플랫폼 설계)

다른 AI들은 "platform/mac.py, windows.py 분리"만 제안했지만, Antigravity는 세 개의 구체적 모듈을 설계했습니다:

```python
# OSCredentialsBridge: 키체인/DPAPI 통합
macOS: Security.framework Keychain
Windows: CryptProtectData (DPAPI, Win32 API)
공통 폴백: PBKDF2 + AES-256-GCM → SQLite (평문 파일 절대 금지)

# OSHardwareCompliance: 네트워크 독립 UUID
macOS: ioreg -rd1 -c IOPlatformExpertDevice → IOPlatformUUID
Windows: HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid
→ VPN/Wi-Fi 변경에도 고정 (IP/Mac 주소 사용 금지)

# OSAutoDriverResolver: 브라우저 드라이버 자동 관리
→ 실행 시 OS + Chrome 버전 감지 → 알맞은 드라이버 자동 다운로드
→ /assets/drivers/ 로컬 캐시
→ 사용자 수동 설치 불필요
```

### 4-B-3. WebSocket/SSE 전환 권고

현재 5초 HTTP polling을 WebSocket 또는 SSE로 전환하면:
- NFC/QR 굿즈 터치 → 0.1초 내 반응 (현재 최대 5초)
- 서버 polling storm 제거
- 대규모 사용자 유입 시 서버 부하 감소

**현재 우선순위**: Phase 1~4 배포 후 Phase 5 이후 작업

### 4-B-4. Vision API 폴백 (예리 스마트에디터 대응)

네이버 에디터 CSS 셀렉터가 변경될 때마다 예리가 뻗는 근본 원인 해결:

```
현재: 하드코딩 CSS 셀렉터 → 네이버 UI 변경 시 즉시 실패
Antigravity 제안:
  1차: 기존 CSS 셀렉터 시도
  실패 시: Vision API로 DOM 스냅샷 → 버튼 좌표 우회 획득
  → 네이버 UI 변경에 자가 복구 (Self-healing)
```

---

## 5. Phase 실행 계획

### ⚡ Phase 0~4: 이미 완료 — 배포만 남음

`ai_staff_rephase_20260523.md` 기준 완료 상태:

```
Phase 0 (Yunmi Alpha): 완료
Phase 1 (Local Key Import): Mac+Web+Server 완료 / Windows installer 빌드 완료
Phase 2 (Songi 안정화): 완료  
Phase 3 (Yunmi Paid Beta): Mac+Web+Server 완료 / Windows installer 빌드 완료
Phase 4 (Windows Lane): installer 완료 / Live 교체 대기
```

**배포 게이트 (민수 확인 필요):**
1. Live Oracle 서버에 웹앱(app.html) 새 버전 배포
2. Live Oracle 서버에 Windows 설치파일 교체 (Phase 1 + 3 각각)
3. 업데이트 메타데이터 반영

---

### 📋 Phase 5: 예리 안정화 + SSOT (배포 완료 후, 1~2주)

**전제 조건**: Phase 0~4 Live 배포 완료 후 진행

---

### 🔧 Phase 5-A: 예리 안정화

**목표**: 예리 실패율 85% → 30% 이하로 낮춘다.

**배경**: 62건 실패 중 content_generation(12) + local_key_missing(9) = 21건이 API 키 혼선 원인. hybrid 구조로 API 키를 서버로 옮기면 절반 이상 해결 가능.

**작업 목록:**

```
[ ] 1. 예리 job payload에 artifact 필드 추가
       파일: oracle/aimax-reports-api/server.js
       내용: jobs.json 스키마에 payload.draft, payload.images, payload.generated_at 추가

[ ] 2. 서버에서 AI 글 생성 처리 (yeri_write 분리)
       현재: 로컬 실행기가 API 키 읽어서 직접 AI 호출
       변경: 서버가 AI 호출 → artifact 저장 → 로컬은 artifact만 가져옴

[ ] 3. 로컬 실행기: artifact 기반 네이버 입력으로 전환
       파일: app.py, split_version/app.py (또는 신규 local_runner/)
       내용: yeri_write 수신 시 job.payload.draft 사용 (직접 AI 호출 제거)

[ ] 4. 재시도 시 artifact 재사용 로직
       내용: status가 ready_for_publish면 AI 생성 건너뜀

[ ] 5. 웹앱에 예리 진행 단계 표시
       파일: app.html
       내용: "글 생성 중" / "네이버 입력 중" / "완료" / "에디터에서 실패 — 재시도 가능"
```

**검증 기준:**
- 네이버 입력 실패 후 재시도 시 AI 비용 미발생
- Mac/Windows 모두 같은 artifact로 입력 가능
- 사용자에게 단계별 상태가 한국어로 표시됨

---

### 🪟 Phase 2: Windows 안정화 (2~3주)

**목표**: 21/22 오류 보고가 Windows에서 나오는 상황을 해결한다.

**배경**: 현재 Windows는 macOS 코드 수작업 포크. 패치가 한쪽에만 적용되는 드리프트가 핵심 원인.

**작업 목록:**

```
[ ] 1. local_runner/ 공통 코어 생성
       구조:
       local_runner/core/poller.py
       local_runner/core/executor.py
       local_runner/core/session.py
       local_runner/workers/yeri.py
       local_runner/workers/hyunju.py

[ ] 2. platform 어댑터 분리
       local_runner/platform/__init__.py  ← OS 감지
       local_runner/platform/mac.py       ← macOS keychain, browser path
       local_runner/platform/windows.py   ← Windows Credential Manager, browser path

[ ] 3. app.py → local_runner 마이그레이션 (macOS)
       기존 app.py의 직원 로직을 local_runner/workers/로 이동
       Tkinter GUI는 local_runner/ui/tray_mac.py로 분리

[ ] 4. split_version/app.py → local_runner 마이그레이션 (Windows)
       동일한 local_runner/core + workers 사용
       Windows 어댑터만 platform/windows.py로

[ ] 5. 실행 모드 지원
       python local_runner/runner.py           (기본: 트레이)
       python local_runner/runner.py --daemon   (백그라운드)
       python local_runner/runner.py --debug    (콘솔)

[ ] 6. Windows smoke 테스트 매트릭스
       - 설치 후 버전 확인
       - 로그인/연결
       - 로컬 설정 저장 (API 키 보존 확인)
       - IME/한글 입력 가드
       - mock headless job polling
```

**검증 기준:**
- macOS와 Windows가 동일한 local_runner/ 코드 사용
- 한쪽 수정 시 자동으로 양쪽 적용
- Windows smoke 매트릭스 통과

---

### 📦 Phase 3: SSOT 정착 (2주)

**목표**: 직원 추가/수정이 파일 하나만 바꾸면 되게 만든다.

**작업 목록:**

```
[ ] 1. workers.json 생성 (위 스키마 참조)
       위치: oracle/aimax-reports-api/data/workers.json

[ ] 2. server.js WORKERS 객체 → workers.json 읽기로 교체
       파일: oracle/aimax-reports-api/server.js (line 165)
       내용: require('./data/workers.json')으로 교체

[ ] 3. GET /api/catalog 엔드포인트 구현
       반환: workers.json 기반 (user.workers 권한 필터 적용)

[ ] 4. app.html 하드코딩 직원 목록 제거
       파일: oracle/aimax-reports-api/static/app.html (line 3302)
       내용: jobKinds 하드코딩 → /api/catalog 호출로 교체

[ ] 5. server.js 모듈 분리 시작
       modules/workers.js, modules/jobs.js, modules/auth.js 분리
       server.js는 import + express setup만 (200줄 목표)
```

**검증 기준:**
- workers.json 한 줄 추가 → 웹/서버 자동 반영
- app.html에 직원 관련 하드코딩 없음

---

### 💾 Phase 4: 설정/비밀값 구조 확정 (1~2주)

**목표**: 사용자가 어디에 무엇을 입력해야 하는지 헷갈리지 않게 한다.

**작업 목록:**

```
[ ] 1. 설정 화면 분리 (웹)
       AI/API 연결 탭: Gemini, OpenAI, Claude, Apify
       네이버 연결 탭: 네이버 ID/비번 (로컬 실행기 전달용)
       실행기 상태 탭: 버전, 연결 상태, 업데이트

[ ] 2. 로컬 설정 화면에서 provider API 키 입력란 제거
       파일: app.py, split_version/app.py
       내용: Gemini/OpenAI 키 입력 UI 제거 (웹에서만 관리)

[ ] 3. 기존 로컬 API 키 → 웹 import 기능
       파일: app.html + server.js
       내용: "기존 키 가져오기" 버튼 → 1회 웹으로 이전 → 로컬에서 삭제

[ ] 4. API 키 저장 후 재노출 금지
       저장 완료 시 "●●●●●●●●" 마스킹, 앞4자+...+뒤4자만 표시
```

**검증 기준:**
- 웹에서 저장한 API 키가 로컬 실행기 작업에 사용됨
- 로컬 설정에 provider API 키 입력란 없음
- blank 저장 시 기존 키 유지됨

---

### 🗄️ Phase 5: DB + 릴리스 개편 (3~4주)

**목표**: 업데이트할수록 안정성이 떨어지는 구조를 끝낸다.

**작업 목록:**

```
[ ] 1. JSON → SQLite WAL 이전
       대상: jobs.json, users.json, sessions.json, commands.json
       이유: 165명 동시 write 시 JSON atomic write만으로는 불충분
       방법: better-sqlite3 + WAL mode (Node.js)

[ ] 2. release manifest 도입
       서버에 /api/version 엔드포인트
       반환: { mac: "1.0.17", windows: "1.0.17", required_min: "1.0.15" }
       앱 시작 시 버전 체크 → 구버전이면 업데이트 안내

[ ] 3. build id 보고
       모든 오류 보고에 build_id, platform, version 포함

[ ] 4. Git 기반 릴리스 파이프라인
       현재: 수작업 zip handoff
       목표: git tag → GitHub Actions → macOS/Windows 빌드 자동화

[ ] 5. no-paid smoke 매트릭스 (배포 전 필수)
       - Python compile 검사
       - Node.js syntax 검사 (node --check)
       - 설정 저장/로드 smoke
       - mock job polling smoke (실제 API 호출 없음)
       - 네이버 에디터 dry-run (실제 발행 없음)
```

---

## 6. 코드 참조 인덱스 (다음 AI 실행 시 필요한 위치)

| 수정 대상 | 파일 | 위치 |
|----------|------|------|
| 직원 정의 | server.js | line 165 (WORKERS 객체) |
| job 종류 | server.js | line 298 (JOB_KINDS) |
| 윤미 접근 제어 | server.js | line 3940 (canAccessYunmi) |
| API 키 마스터 키 | server.js | line 817 (getUserSecretKey) |
| JSON read/write | server.js | line 606-615 (readJsonFile, writeJsonAtomic) |
| 전체 라우트 테이블 | server.js | line 7775-8073 |
| 웹 직원 목록 하드코딩 | app.html | line 3302 (jobKinds) |
| 웹 직원 카탈로그 병합 | app.html | line 4554 (applyWorkerCatalog) |
| 윤미 작업 폼 | app.html | line 2670 |
| 로컬 설정 저장 | app.py | line 662 (save_settings) |
| 로컬 보안 설정 저장 | app.py | line 675 (save_local_security_settings) |
| 원격 job 처리 | app.py | line 1785 (_worker_remote_job) |
| 윤미 admin 버튼 없음 | admin.html | 없음 (신규 추가 필요) |

---

## 7. 교차검증 질문 (다음 AI가 검토해야 할 사항)

Final Opinion 문서에서 제기한 질문들:

1. 예리를 `hybrid`로 두는 판단이 맞는가?
2. 송이/윤미를 `web-first`로 두는 판단이 맞는가?
3. AI/API 키는 웹 저장, 네이버 계정은 로컬 저장으로 분리하는 것이 보안/UX 관점에서 맞는가?
4. 기존 로컬 API 키를 웹으로 import할 때 사용자 동의와 실패 복구 설계가 충분한가?
5. Mac/Windows 공통 코어 + 플랫폼 adapter 구조가 현재 코드에서 현실적인가?
6. `app.py`와 `split_version/app.py` 중복 제거를 어느 단계에서 해야 하는가?
7. JSON에서 SQLite WAL로 먼저 갈지, 바로 Postgres로 갈지 운영 규모상 무엇이 맞는가?
8. 미완성 직원을 숨기는 것이 판매/마케팅과 제품 신뢰 사이에서 맞는 균형인가?
9. 예리 실패 재시도 시 비용 중복 방지 설계가 충분한가?
10. 사용자가 보는 UI에서 더 제거해야 할 버튼이나 정보가 있는가?

---

## 8. 절대 하지 말아야 할 것

```
❌ 나경/현성/상수를 실행 가능한 직원처럼 노출
❌ 로컬 설정 저장 시 기존 API 키 덮어쓰기
❌ 서버 API 키를 로컬로 다시 내려주는 흐름 구현
❌ 웹/서버에서 네이버 비밀번호 저장
❌ admin.html 없이 새 직원 접근 제어 추가
❌ server.js에 코드 계속 붙여넣기 (모듈 분리 전까지 최소 추가만)
❌ Windows smoke 통과 전 Windows 배포
```

---

## 9. 첫 실행 커맨드 (Phase 0)

다음 AI가 Phase 0를 바로 시작할 경우 이 순서로:

```bash
# 1. 현재 코드 상태 확인
node --check oracle/aimax-reports-api/server.js
python -m py_compile app.py
python -m py_compile split_version/app.py

# 2. 윤미 관련 현재 상태 확인
grep -n "canAccessYunmi\|yunmi_access\|yunmi" oracle/aimax-reports-api/server.js | head -30
grep -n "yunmi" oracle/aimax-reports-api/static/admin.html | head -20

# 3. songi_research 불일치 확인
grep -n "songi_research" oracle/aimax-reports-api/server.js
grep -n "songi_research" oracle/aimax-reports-api/static/app.html

# 4. API 키 저장/로드 경로 확인
grep -n "getUserSecretKey\|user-secrets\|keyring" oracle/aimax-reports-api/server.js | head -20
grep -n "keyring\|settings_secrets" app.py | head -20
```

---

*이 문서는 Claude Sonnet 4.6이 4개 AI 보고서 교차검증 후 작성했습니다.*  
*다음 AI는 이 문서를 기반으로 Phase 0부터 순서대로 실행하면 됩니다.*

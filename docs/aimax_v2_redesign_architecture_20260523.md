# AIMAX v2 재설계 — 최종 아키텍처 제안서

> 작성일: 2026-05-23  
> 목적: 처음부터 구조/설계 재설계 (Mac/Windows 크로스플랫폼 포함)  
> 상태: 교차 검증 대기 중

---

## 핵심 설계 원칙 (3가지)

```
1. 직원 = 서버가 정의한다 (Single Source of Truth)
2. 로컬 앱 = 실행기만 한다 (Mac/Windows 동일 코드)
3. UI = 지금 할 수 있는 것만 보인다 (Context-aware UI)
```

---

## 현재 vs 재설계 구조 비교

| 항목 | 현재 | v2 |
|------|------|-----|
| 직원 정의 | server.js + app.html 이중 | server.js 단일 `/api/catalog` |
| API 키 경로 | 웹 저장 ≠ 로컬 읽기 | 서버 Vault → 로컬 캐시 동기화 |
| 윤미 접근 | 하드코딩 whitelist | DB `users.yunmi_access` boolean |
| 크로스플랫폼 | macOS/Windows 별도 파일 | 단일 `runner.py` (공통) |
| 버전 동기화 | 수작업 zip handoff | 서버가 버전 broadcast |
| UI 상태 | 항상 모든 버튼 노출 | 실행 가능 여부에 따라 동적 표시 |

---

## 레이어 구조 (3-Layer)

```
┌─────────────────────────────────────────────────┐
│  LAYER 3: 웹 앱 (app.html)                      │
│  - 주문서만 작성 (직원 선택 → 지시 → 확인)      │
│  - 서버 catalog 받아서 렌더링 (하드코딩 없음)   │
└────────────────────┬────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────┐
│  LAYER 2: 서버 (server.js → 분리된 모듈)        │
│  - workers/         직원 정의 SSOT              │
│  - jobs/            큐 + 상태 관리              │
│  - vault/           API 키 (암호화 저장)        │
│  - admin/           권한 관리 (DB 기반)         │
└──────┬─────────────────────────────┬────────────┘
       │ polling (5s)                │ webhook
┌──────▼──────────────┐   ┌──────────▼────────────┐
│  LAYER 1: 로컬 실행기│   │  LAYER 1: 웹 모듈     │
│  runner.py          │   │  (서버 내 직접 실행)  │
│  - Mac/Windows 공통 │   │  - 윤미, 송이         │
│  - 예리, 현주만     │   └───────────────────────┘
│  - keyring 불필요   │
└─────────────────────┘
```

---

## Part 1: 서버 재설계

### 1-1. 파일 분리 (8,081줄 → 모듈화)

```
oracle/aimax-reports-api/
├── server.js              # 진입점 (200줄 이하, import만)
├── modules/
│   ├── workers.js         # 직원 정의 + catalog API
│   ├── jobs.js            # 큐 관리
│   ├── vault.js           # API 키 암호화 저장
│   ├── auth.js            # 로그인 + 세션
│   └── admin.js           # 권한 관리
├── data/
│   ├── users.json
│   ├── jobs.json
│   └── workers.json       # 직원 정의 (새로 추가)
└── static/
    ├── app.html
    └── admin.html
```

### 1-2. 직원 정의 SSOT (workers.json)

```json
{
  "yeri": {
    "id": "yeri",
    "name": "예리",
    "role": "블로그 글쓰기",
    "execution": "local_agent",
    "job_kinds": ["yeri_write"],
    "requires_local": true,
    "icon": "✍️",
    "enabled": true
  },
  "hyunju": {
    "id": "hyunju",
    "name": "현주",
    "role": "네이버 검색",
    "execution": "local_agent",
    "job_kinds": ["hyunju_find"],
    "requires_local": true,
    "icon": "🔍",
    "enabled": true
  },
  "yunmi": {
    "id": "yunmi",
    "name": "윤미",
    "role": "스크립트 실행",
    "execution": "web_module",
    "job_kinds": ["yunmi_script"],
    "requires_local": false,
    "access_controlled": true,
    "icon": "⚙️",
    "enabled": true
  },
  "songi": {
    "id": "songi",
    "name": "송이",
    "role": "리서치",
    "execution": "web_module",
    "job_kinds": ["songi_research"],
    "requires_local": false,
    "icon": "📊",
    "enabled": true
  }
}
```

> 이 파일 하나가 바뀌면 서버/웹/로컬 앱 전체에 자동 반영

### 1-3. 윤미 접근 제어 (DB 기반으로 전환)

```javascript
// 현재 (문제): 하드코딩 whitelist
function canAccessYunmi(user) {
  const whitelist = ['user1@test.com'];
  return whitelist.includes(user.email);
}

// v2 (수정): DB 필드 기반
function canAccessYunmi(user) {
  return user.yunmi_access === true;
}
```

Admin 패널 토글 API:
```javascript
// POST /api/admin/users/:userId/yunmi-access
router.post('/admin/users/:userId/yunmi-access', adminOnly, async (req, res) => {
  const { enabled } = req.body;
  await updateUser(req.params.userId, { yunmi_access: enabled });
  res.json({ success: true });
});
```

### 1-4. API 키 단절 해결

```
현재: 웹(user-secrets.json AES) ↔ 로컬(keyring) → 각각 별도
v2:  서버 vault → GET /api/vault/keys (인증 후) → 로컬 메모리 캐시 (파일 저장 안 함)
```

```python
async def get_api_key(session_token, key_name):
    resp = await http.get(f"{server}/api/vault/keys/{key_name}",
                          headers={"Authorization": f"Bearer {session_token}"})
    return resp.json()["value"]  # 메모리에만 보관
```

---

## Part 2: 로컬 실행기 재설계 (크로스플랫폼 핵심)

### 2-1. 현재 문제

```
macOS:   app.py (5,416줄) → macOS 전용 keyring, Tkinter 경로
Windows: split_version/app.py → 별도 유지, 수작업 sync
→ 직원 로직 수정 시 두 파일 각각 수정 필요
```

### 2-2. v2 구조 (단일 코드베이스)

```
local_runner/
├── runner.py          # 진입점 (Mac/Windows 공통)
├── core/
│   ├── poller.py      # Job polling (공통)
│   ├── executor.py    # 작업 실행 라우터 (공통)
│   └── session.py     # 서버 인증 (공통)
├── workers/
│   ├── yeri.py        # 예리 작업 (공통)
│   └── hyunju.py      # 현주 작업 (공통)
├── platform/
│   ├── __init__.py    # OS 감지
│   ├── mac.py         # macOS 전용 (keychain, AppleScript)
│   └── windows.py     # Windows 전용 (registry, COM)
└── ui/
    ├── tray_mac.py    # macOS 메뉴바
    └── tray_win.py    # Windows 트레이
```

### 2-3. OS 감지 + 분기

```python
# platform/__init__.py
import platform

def get_platform():
    system = platform.system()
    if system == "Darwin":
        from . import mac as impl
    elif system == "Windows":
        from . import windows as impl
    else:
        raise RuntimeError(f"지원하지 않는 OS: {system}")
    return impl

# 어디서든 동일하게 사용
plat = get_platform()
plat.open_browser(url)
plat.show_notification("예리가 작업을 완료했어요")
```

### 2-4. 로컬 실행기 동작 흐름 (v2)

```
[시작] → runner.py
  ↓
session.py: 서버 로그인 (이메일+비번)
  ↓
poller.py: GET /api/jobs/next (5초마다)
  ↓ (작업 있으면)
executor.py: job.kind 분기
  ├── yeri_write → workers/yeri.py
  └── hyunju_find → workers/hyunju.py
  ↓
작업 실행 (API 키는 서버 vault에서 즉시 조회, 메모리만)
  ↓
PUT /api/jobs/:id/complete
  ↓
[대기로 복귀]
```

### 2-5. 실행 모드

```bash
python runner.py              # 기본: 트레이 아이콘
python runner.py --daemon     # 백그라운드 데몬
python runner.py --no-ui      # headless (서버 환경)
python runner.py --debug      # 콘솔 출력 (개발용)
```

### 2-6. Windows 특이사항 처리

```python
# platform/windows.py
import winreg
import ctypes

def open_browser(url):
    import webbrowser
    webbrowser.open(url)

def show_notification(message):
    # Windows Toast Notification
    from winotify import Notification
    toast = Notification(app_id="AIMAX", title="AIMAX", msg=message)
    toast.show()

def get_chrome_path():
    # Registry에서 Chrome 경로 조회
    key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,
                         r"SOFTWARE\Google\Chrome\Application")
    return winreg.QueryValueEx(key, "")[0]
```

---

## Part 3: 웹 UI 재설계 (미니멀)

### 3-1. 핵심 원칙

```
"지금 할 수 없는 것은 보이지 않는다"
```

### 3-2. 직원 카드 표시 조건

| 직원 | 표시 조건 |
|------|----------|
| 예리 | 로컬 앱 연결 + 네이버 API 키 있음 |
| 현주 | 로컬 앱 연결 |
| 윤미 | `user.yunmi_access === true` |
| 송이 | 항상 표시 (웹 모듈) |

### 3-3. 메인 화면 와이어프레임

```
┌─────────────────────────────────────────────┐
│  AIMAX    [민수님 ▼]              [설정 ⚙️]  │
├─────────────────────────────────────────────┤
│                                             │
│  오늘 할 일                                 │
│  ┌──────────┐  ┌──────────┐               │
│  │ ✍️ 예리  │  │ 🔍 현주  │               │
│  │ 블로그   │  │  검색    │               │
│  │ [시작 →] │  │ [시작 →] │               │
│  └──────────┘  └──────────┘               │
│                                             │
│  진행 중                                    │
│  ┌────────────────────────────────────────┐│
│  │ ✍️ 예리 | "클로드 AI 리뷰" 작성 중... ││
│  │ ████████░░░░  70%         [취소]      ││
│  └────────────────────────────────────────┘│
│                                             │
│  최근 완료                                  │
│  • 현주 | 네이버 검색 "AI 도구 비교" → [보기]│
│  • 예리 | 블로그 글 작성 완료 → [보기]     │
└─────────────────────────────────────────────┘
```

### 3-4. 작업 지시 화면

```
┌─────────────────────────────────────────────┐
│  ← 예리에게 지시하기                         │
├─────────────────────────────────────────────┤
│                                             │
│  블로그 주제                                │
│  ┌─────────────────────────────────────┐   │
│  │ 클로드 AI vs ChatGPT 비교 리뷰      │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  키워드 (선택)                              │
│  ┌─────────────────────────────────────┐   │
│  │ AI 도구, 비교, 2026                 │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  글 길이: [단편 500자] [중편 1000자] ●장편 │
│                                             │
│              [예리 시작 →]                  │
│                                             │
│  ⚠️ 로컬 앱 연결 필요 — 지금 연결됨 ✅    │
└─────────────────────────────────────────────┘
```

### 3-5. Admin 패널 윤미 접근 토글 (신규)

```
┌─────────────────────────────────────────────┐
│  구매자 관리                                 │
├─────────────────────────────────────────────┤
│  민수 | stresspoon@gmail.com               │
│  직원 접근: [예리 ✅] [현주 ✅] [윤미 🔘]  │
│             토글 클릭 → 즉시 DB 반영       │
├─────────────────────────────────────────────┤
│  홍길동 | test@test.com                     │
│  직원 접근: [예리 ✅] [현주 ✅] [윤미 ❌]  │
└─────────────────────────────────────────────┘
```

---

## Part 4: 데이터 구조 (SSOT 적용)

### users.json v2

```json
{
  "userId": "abc123",
  "email": "stresspoon@gmail.com",
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

### jobs.json v2

```json
{
  "jobId": "job_xyz",
  "userId": "abc123",
  "worker": "yeri",
  "kind": "yeri_write",
  "input": { "topic": "클로드 리뷰", "length": "long" },
  "status": "running",
  "created_at": "2026-05-23T10:00:00Z",
  "started_at": "2026-05-23T10:00:05Z",
  "completed_at": null,
  "result": null,
  "error": null
}
```

---

## Part 5: 마이그레이션 로드맵

### Phase 0 (1주) — 지금 당장 터진 것 수리
```
1. admin.html에 윤미 토글 버튼 추가
2. canAccessYunmi() DB 필드 기반으로 수정
3. app.html의 songi_research 서버 JOB_KINDS에 추가
4. app.py _worker_remote_job()에 yunmi_script 처리 추가
```

### Phase 1 (2주) — SSOT 정착
```
1. workers.json 파일 생성
2. server.js WORKERS 객체 → workers.json 읽기로 교체
3. app.html catalog 하드코딩 → /api/catalog 완전 의존
4. API 키: 웹 vault → 로컬 동기화 경로 단일화
```

### Phase 2 (3주) — 크로스플랫폼 실행기
```
1. local_runner/ 디렉토리 신규 생성
2. platform/mac.py, platform/windows.py 분리
3. GUI 없는 daemon 모드 구현
4. Windows 테스트 (VM 또는 실제 기기)
```

### Phase 3 (2주) — UI 미니멀화
```
1. 직원 카드 동적 표시 로직 (catalog + user.workers)
2. 진행 중 작업 실시간 표시 (polling or SSE)
3. 완료 목록 최근 5개
4. Admin 권한 토글 UI
```

---

## 최종 판단

**왜 처음부터 다시 짜야 하나:**

현재 코드는 기능이 추가될 때마다 server.js에 붙여넣은 성장통 구조입니다. 8,081줄 단일 파일은 유지보수 불가 수준이고, API 키 이중 저장과 하드코딩된 접근 제어는 신규 직원 추가 시마다 3~4곳을 동시에 수정해야 합니다.

**무엇을 지켜야 하나:**

사용자 여정(로그인 → 직원 선택 → 지시 → 결과 확인)은 현재 구조가 잘 만들어져 있습니다. 이 흐름은 그대로 유지하되 내부 배관만 교체합니다.

**크로스플랫폼이 왜 지금 중요하나:**

로컬 실행기가 Mac 전용으로 굳어지면 Windows 사용자는 예리/현주를 영영 못 씁니다. Phase 2가 미뤄질수록 두 파일 각각 수정하는 기술 부채가 쌓입니다. `platform/__init__.py` OS 감지 패턴은 Linux 서버 headless 모드도 자연스럽게 지원합니다.

---

*교차 검증: Codex 보고서, Gemini 보고서와 비교 예정*

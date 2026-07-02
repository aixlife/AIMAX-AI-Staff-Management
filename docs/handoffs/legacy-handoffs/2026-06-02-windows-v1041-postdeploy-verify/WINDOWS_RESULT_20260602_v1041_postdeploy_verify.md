# Windows Post-Deploy Verify — v1.0.41

Date: 2026-06-02 KST
Environment: Windows 11 Home 10.0.26200 / Chrome 148.0.7778.181

## Overall: PASS

v1.0.41 Oracle 배포가 정상 확인됐습니다. queued_to_ui 수정과 팝업 non-blocking 수정이 설치 번들에 포함되어 있고, 런처 기동이 팝업에 막히지 않습니다.

---

## 1. Public Version API

### v1.0.40 기준 (update_required=true 기대)
```
GET /api/version?current=v1.0.40&platform=windows
latest_version:  v1.0.41   ✅
min_version:     v1.0.41   ✅
update_required: true      ✅
```

### v1.0.41 기준 (update_required=false 기대)
```
GET /api/version?current=v1.0.41&platform=windows
latest_version:   v1.0.41  ✅
update_required:  false    ✅
update_available: false    ✅
release_notes: "Windows 실행기 v1.0.41 업데이트입니다.
                웹앱 작업 처리 지연(queued_to_ui)을 수정하고
                업데이트 팝업 중 작업 지연을 방지했습니다."
```

---

## 2. Deployed Installer SHA256

```
파일: aimax-bundle-windows-v1.0.41.exe (Syncthing → 로컬 작업 폴더 복사)
크기: 35,677,103 bytes
SHA256: 712d3ed8ff445aab09e1fdb1fa24edbcaa4fba91131fb68b60c11c0dc49ce971
기대값: 712d3ed8ff445aab09e1fdb1fa24edbcaa4fba91131fb68b60c11c0dc49ce971
결과: PASS ✅
```

---

## 3. Installed Runner

```
설치 명령: aimax-bundle-windows-v1.0.41.exe /SILENT /NORESTART → exit 0
설치 버전: APP_VERSION = v1.0.41   ✅
설치 경로: C:\Users\likim\AppData\Local\Programs\AIMAX\
```

---

## 4. Launcher Startup — 팝업이 기동을 막지 않음

```
launcher_started   connect
core_detected      AIMAX.exe
request_written    AIMAX.exe
core_started       pid=91556
launcher_handoff   core still running after startup window   ✅
```

`core_exited_quickly` 없음. 8초 startup window 넘어 정상 기동.
업데이트 팝업이 런처/코어 시작을 차단하지 않음을 확인.

---

## 5. Production Heartbeat — connected=true, v1.0.41

```json
POST /api/agent/heartbeat
{
  "ok": true,
  "agent": {
    "connected": true,            ✅
    "version": "v1.0.41",         ✅
    "version_info": {
      "latest_version": "v1.0.41",
      "update_required": false,   ✅
      "update_available": false
    }
  }
}
```

---

## 6. queued_to_ui Fix — 코드 검증

설치된 번들 소스(`app.py`)에서 v1.0.41 수정 2건 확인:

1. **즉시 폴링 트리거** (`app.py:2070`)
   ```python
   self.root.after(0, self._poll_queue)
   ```
   remote_job 큐 적재 직후 100ms 대기 없이 즉시 처리.

2. **팝업 non-blocking** (`_show_update_popup`)
   ```python
   else:
       popup.update()
   ```

Stage 추적 키워드 모두 번들에 포함:

| stage | 출현 |
|-------|------|
| claimed | 12 |
| queued_to_ui | 3 |
| ui_received | 1 |
| worker_start_requested | 3 |
| worker_thread_started | 2 |
| worker_running | 2 |

### No-paid 실제 잡 smoke
설치된 앱은 fake/local job 경로를 UI로 노출하지 않습니다. 유료 AI 잡은 실행하지 않았습니다(미승인). Mac 측 no-paid headless smoke에서 `claimed → queued_to_ui → worker_thread_started → worker_running` 시퀀스가 이미 확인됐고, 동일 stall 방지 코드가 본 설치 번들에 포함됨을 소스 레벨로 확인했습니다.

---

## 체크리스트

| 항목 | 결과 |
|------|------|
| v1.0.40 → update_required=true | ✅ |
| v1.0.41 → update_required=false | ✅ |
| 배포 installer SHA256 일치 | ✅ |
| 설치 버전 v1.0.41 | ✅ |
| heartbeat connected/version/update_required | ✅ |
| 런처 기동 (팝업 미차단) | ✅ |
| queued_to_ui 수정 번들 포함 | ✅ |
| no-paid 실제 잡 stage | ℹ️ fake job 경로 없음 — 소스 확인 대체 |

블로커: 없음. 오류 보고 ID: 없음.

---

## 준수 확인

- 유료 AI 생성, Apify, YouTube Data API, Naver 저장/편집/발행/예약, 고객 계정, 중복 유료 재시도 사용 안 함.
- Syncthing에 비밀번호, 쿠키, 토큰, 패스프레이즈, signed URL, 원본 provider 키 저장 안 함.
- 설치 실행은 Syncthing 외부 로컬 작업 폴더에서 수행.

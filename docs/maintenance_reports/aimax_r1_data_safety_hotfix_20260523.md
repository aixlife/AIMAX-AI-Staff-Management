# AIMAX R1 Data Safety Hotfix

작성일: 2026-05-23 KST
작성자: Mac Codex
상태: 운영 배포 완료

---

## 한 줄 결론

R1 Data Safety Hotfix를 운영 서버에 배포했다. 이제 AIMAX 서버는 핵심 JSON 저장소가 깨졌을 때 빈 fallback으로 조용히 진행하지 않고 fail-closed로 막으며, health endpoint에서 storage 상태를 노출한다.

---

## 수정 범위

파일:

- `oracle/aimax-reports-api/server.js`
- `scripts/smoke_json_storage_safety.mjs`
- `docs/deployments/oracle-deploy-20260523-173412.md`

주요 변경:

- `readJsonFile()`이 JSON parse 실패 시 fallback을 반환하지 않고 `json_read_failed`로 fail-closed 처리
- 핵심 저장소 array field shape 검증 추가
  - `users`
  - `sessions`
  - `secrets`
  - `tokens`
  - `jobs`
  - `agents`
  - `commands`
  - `orders`
  - `projects/items`
- `writeJsonAtomic()`에 temp write, fsync, 이전 파일 `.bak` 백업, atomic rename 적용
- JSONL index rewrite에도 durable write 적용
- 신규 오류 보고 저장은 `writeJsonAtomic()` + durable JSONL append로 변경
- `/api/reports/health`에 `storage` 상태 추가
- storage 오류 발생 시 request catch가 `storage_unavailable` 503으로 응답
- 서버를 `require()`해 storage helper를 테스트할 수 있도록 `require.main === module` guard 추가

---

## 운영 배포

배포 문서:

- `docs/deployments/oracle-deploy-20260523-173412.md`

운영 backup:

- `/home/ubuntu/aimax-backups/20260523-173412`

운영 server.js SHA:

- `02123745e7e380bf5b9ba33cbff6d13a23e48f1666407e70795857b5924399fa`

---

## 검증

로컬 문법/스모크:

- `node --check oracle/aimax-reports-api/server.js`
- `node --check scripts/smoke_json_storage_safety.mjs`
- `python -m py_compile app.py split_version/app.py local_agent/runtime.py web_agent/client.py`
- `APP_HTML_SCRIPT_SYNTAX_OK`
- `JSON_STORAGE_SAFETY_SMOKE_OK`

기존 no-paid 회귀:

- `USER_SECRETS_SMOKE_OK`
- `LOCAL_SECRET_IMPORT_SMOKE_OK`
- `APIFY_LOCAL_READINESS_SMOKE_OK`
- `YUNMI_ALPHA_SMOKE_OK`
- `YUNMI_PAID_READY_SMOKE_OK`
- `YUNMI_ACCESS_GATE_SMOKE_OK`

운영 health:

```json
{
  "ok": true,
  "storage": {
    "ok": true,
    "checked_files": 10,
    "issues": [],
    "recent_issues": []
  }
}
```

운영 version:

- Windows `current=v1.0.17` -> update not required
- macOS `current=v1.0.10` -> update not required

---

## Windows 영향

Windows installer 재빌드는 필요 없다.

Windows Codex 후속 smoke 결과:

- 반환 파일: `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-23-r1-data-safety-hotfix/WINDOWS_RESULT_20260523_r1_data_safety_hotfix.md`
- Status: `PASS`
- R1 blocker: `none found`
- Windows agent version: `v1.0.17`
- Health: `storage.ok=true`, `storage.issues=[]`
- Version API: Windows `v1.0.17`, update not required
- Web login/agent status/AI API connection/error report screen: pass
- No paid AI, no paid Apify, no Naver save/publish/draft-save

확인 항목:

- Windows 웹 로그인
- agent status
- AI/API 연결 상태
- 오류 보고 제출 화면 접근
- `/api/reports/health`에 `storage.ok=true` 표시

---

## 다음 단계

R1 후 다음 phase는 R2 Worker Registry SSOT다.

Windows Codex의 R1 smoke에서도 blocker가 없으므로 R2를 진행할 수 있다.

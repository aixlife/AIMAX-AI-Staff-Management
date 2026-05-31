# AIMAX R3-C 예리 Local Artifact Consumer 보고서

작성: 2026-05-25

## 결론

R3-C의 코드 구현과 no-paid 검증을 완료했다.

- Mac/Windows 로컬 실행기가 `yeri_write` job의 `artifact.content_markdown`을 받을 수 있도록 했다.
- artifact가 있으면 로컬 실행기는 AI 텍스트 생성 단계를 건너뛰고 `server_artifact_parse` 단계에서 마크다운을 파싱한다.
- 네이버 ID/비밀번호는 계속 로컬 전용이다.
- 이미지 프롬프트가 있고 사용자가 이미지를 원하면 로컬 Gemini/OpenAI 이미지 키는 여전히 필요하다.
- 서버는 `AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED=1`일 때만 `ready_for_publish` job을 agent에게 내려준다.
- 운영 서버에는 claim flag 기본 off 상태로 배포했다. 구버전 실행기와 섞이는 위험은 막혀 있다.

## 변경 파일

- `oracle/aimax-reports-api/server.js`
- `app.py`
- `split_version/app.py`
- `scripts/smoke_yeri_ready_claim_gate.mjs`
- `scripts/smoke_yeri_local_artifact_contract.py`

## 동작 계약

### 서버

- 기본 claim 대상: `queued`
- opt-in claim 대상: `queued`, `ready_for_publish`
- opt-in env:
  - `AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED=1`

### 로컬 실행기

`job.artifact.content_markdown`이 있으면:

1. `generate_blog_content()` 호출 생략
2. artifact markdown을 `parse_markdown()`으로 파싱
3. artifact title 우선 사용
4. 서버 usage를 결과 usage에 합산
5. 네이버 에디터 진입/입력/저장/발행 흐름은 기존 그대로 사용

## 검증

문법/정적 계약:

```text
node --check oracle/aimax-reports-api/server.js
node --check scripts/smoke_yeri_ready_claim_gate.mjs
python3 -m py_compile app.py split_version/app.py web_agent/client.py scripts/smoke_yeri_local_artifact_contract.py
YERI_LOCAL_ARTIFACT_CONTRACT_SMOKE_OK
```

로컬 HTTP smoke:

```text
YERI_READY_CLAIM_GATE_SMOKE_OK
YERI_SERVER_GENERATION_MOCK_SMOKE_OK
YERI_PAID_GENERATION_GUARD_SMOKE_OK
YERI_HYBRID_RETRY_API_SMOKE_OK
JOB_PLATFORM_TARGETING_SMOKE_OK
WORKER_CATALOG_CONTRACT_SMOKE_OK
JSON_STORAGE_SAFETY_SMOKE_OK
YUNMI_ACCESS_GATE_SMOKE_OK
```

## 배포

Oracle web 배포 완료.

- 배포 리포트: `docs/deployments/oracle-deploy-20260525-020730.md`
- live `server.js` sha256: `c1ccdcbb864071b9b36c6ce8c9d1b9355d99368b82d9e41e69fecd42a4ae6163`
- health: `ok=true`, storage `ok=true`
- service: `active`
- claim flag: systemd env 출력 기준 별도 설정 없음, 즉 기본 off

## 남은 게이트

R3-C는 아직 운영 활성화하면 안 된다.

필수 후속:

1. Windows Codex가 같은 소스와 smoke를 검증한다. 완료.
2. Windows 실행기 재빌드 필요 여부를 판단한다. 필요함.
3. Windows 설치본 재빌드를 완료한다. 현재 blocked: Windows 환경에 Go compiler가 없어 `aimax-agent-launcher.exe`를 만들 수 없음.
4. macOS 실행기도 같은 로컬 artifact 소비 코드가 들어간 설치본을 빌드/검증한다. 완료, 배포 대기.
5. Windows `v1.0.18` 설치본과 macOS `v1.0.11` 설치본을 함께 배포한다. 완료.
6. 각 OS에서 새 설치본 설치/연결 확인 후에만 `AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED=1`을 켠다.
7. 실제 유료 Gemini 서버 생성은 별도 승인 전까지 켜지 않는다.

## Windows 반환 결과

반환 파일:

```text
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-25-r3c-yeri-local-artifact-consumer/WINDOWS_RESULT_20260525_r3c_yeri_local_artifact_consumer.md
```

판정:

```text
verdict: blocked
```

Windows no-paid/static/live read-only 검증은 통과했다.

- `YERI_LOCAL_ARTIFACT_CONTRACT_SMOKE_OK`
- `YERI_READY_CLAIM_GATE_SMOKE_OK`
- `YERI_SERVER_GENERATION_MOCK_SMOKE_OK`
- `YERI_PAID_GENERATION_GUARD_SMOKE_OK`
- `YERI_HYBRID_RETRY_API_SMOKE_OK`
- `JOB_PLATFORM_TARGETING_SMOKE_OK`
- `WORKER_CATALOG_CONTRACT_SMOKE_OK`
- `JSON_STORAGE_SAFETY_SMOKE_OK`
- `YUNMI_ACCESS_GATE_SMOKE_OK`

차단 사유는 코드 문제가 아니라 Windows installer rebuild 환경 문제다.

- `app.py`, `split_version/app.py`가 바뀌었으므로 Windows 설치본 재빌드가 필요하다.
- Windows `build.py`는 `aimax-agent-launcher.exe` 생성을 위해 Go compiler가 필요하다.
- 해당 Windows Codex 환경에서 `where.exe go` 실패, `C:\Program Files\Go\bin\go.exe` 없음.

따라서 Windows 후속은 Go 설치 또는 `AIMAX_GO_EXE` 지정 후 같은 R3-C source bundle로 `python build.py`를 다시 실행하는 것이다.

## macOS 빌드 결과

빌드/검증 보고서:

```text
docs/deployments/macos-build-20260525-v111-r3c-artifact-consumer.md
```

결과:

- `venv/bin/python build.py` 완료.
- `CFBundleShortVersionString`: `1.0.11`
- diagnostics `system.app.version`: `v1.0.11`
- diagnostics `system.runtime.frozen`: `true`
- diagnostics `ai_text_import_smoke.ok`: `true`
- `codesign --verify --deep --strict dist/AIMAX.app`: pass
- `hdiutil verify dist/AIMAX-macos.dmg`: checksum valid

Staged artifact:

```text
dist/upload_installers/aimax-bundle-macos.dmg
```

SHA256:

```text
1a746f909d973a6442bd813a78ed4e3f17972652b9a6f3c0e6539e6f2d071b38
```

## Installer 배포 결과

배포 보고서:

```text
docs/deployments/oracle-deploy-20260525-r3c-v111-v118-installers.md
```

운영 설치본:

- macOS bundle `v1.0.11`: `1a746f909d973a6442bd813a78ed4e3f17972652b9a6f3c0e6539e6f2d071b38`
- Windows bundle `v1.0.18`: `f4730bfa12fefd448c35e4fe66f7146110f3991db3dc79b792eb3bbd9f5c143e`

공개 version API:

- macOS `current=v1.0.10` -> `update_required=true`
- macOS `current=v1.0.11` -> `update_required=false`
- Windows `current=v1.0.17` -> `update_required=true`
- Windows `current=v1.0.18` -> `update_required=false`

R3-C 활성화 flag:

```text
R3C_FLAGS_DEFAULT_OFF
```

## Windows post-deploy 설치 검증

반환 파일:

```text
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-25-r3c-windows-post-deploy-install-check/WINDOWS_RESULT_20260525_r3c_windows_post_deploy_install_check.md
```

판정:

```text
pass
```

확인:

- 설치본 SHA256 일치: `F4730BFA12FEFD448C35E4FE66F7146110F3991DB3DC79B792EB3BBD9F5C143E`
- 설치된 앱 diagnostics `system.app.version`: `v1.0.18`
- 설치된 앱 diagnostics `system.runtime.frozen`: `true`
- 설치된 앱 diagnostics `ai_text_import_smoke.ok`: `true`
- 공개 version API: Windows `v1.0.17`은 update required, `v1.0.18`은 최신.

주의:

- Windows 쪽은 안전한 비고객 테스트 계정이 없어서 runner 연결/웹 배너 소멸 확인은 실행하지 않았다.
- R3-C claim flag는 아직 꺼져 있으며, 명시 승인 후에만 켠다.

## No-Paid / No-Mutation

- 실제 Gemini/OpenAI/Claude/Apify 호출 없음
- Naver 로그인/저장/발행 없음
- mock artifact와 로컬 서버 smoke만 사용

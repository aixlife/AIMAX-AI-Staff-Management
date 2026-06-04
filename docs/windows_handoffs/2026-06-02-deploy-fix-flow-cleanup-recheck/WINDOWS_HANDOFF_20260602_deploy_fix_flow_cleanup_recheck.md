# Windows Handoff - 2026-06-02 deploy fix / flow cleanup recheck

## Goal

Mac/Oracle side에서 2026-06-02 handoff의 desktop 공통 소스와 Oracle server generation 보완을 반영했다. Windows 쪽은 서버 배포가 아니라 Windows local runner 공통 코드가 깨지지 않았는지 검증하고, 필요하면 Windows 빌드/스모크 증거를 돌려주는 것이 목표다.

## Source package

Syncthing 폴더의 `source/changed-files/`에 현재 Mac 작업공간에서 복사한 Windows 관련 변경 파일을 넣어둔다.

- `.github/workflows/build.yml`
- `app.py`
- `build.py`
- `content/ai_text.py`
- `paths.py`
- `posting/editor.py`
- `posting/publisher.py`
- `requirements.txt`
- `scripts/preflight_split_drift.py`
- `scripts/verify_schedule_publish_smoke.py`

주의: Syncthing 폴더 안에서 빌드하지 말고, Windows 로컬 작업 폴더로 복사해서 검증한다.

## What changed on Mac side

- `posting/editor.py`: 제목 입력을 click/type/clipboard/JS fallback으로 보강하고 macOS/Windows 클립보드 이미지 분기를 명확히 했다. 기존 image failure diagnostics는 유지되도록 복구했다.
- `posting/publisher.py`: 임시저장/예약 관련 완료 판단을 더 견고하게 반영한 handoff 소스를 머지했다.
- `content/ai_text.py`: 로컬 fallback 생성에서 Claude 재시도/오류 분류, `claude-sonnet-4-6`, Gemini legacy alias normalization을 반영했다. OpenAI `reasoning.effort`는 기존 AIMAX 호환값인 `low`로 유지했다.
- `app.py`: 기본 Gemini 모델을 공식 모델 코드 `gemini-3.1-pro-preview`로 맞추고 legacy alias를 보정했다. Mac 실제 테스트에서 발견된 `image_count=0`이 `or 3` fallback 때문에 3장으로 되살아나는 버그도 `_payload_image_count()`로 수정했다.
- `paths.py`: 앱 데이터 이름은 `AIMAX`로 유지했다. `NaverBlogAuto`는 legacy fallback 후보로만 남긴다.
- `.github/workflows/build.yml`: source preflight를 Windows/macOS job에 유지했다.

## Windows validation steps

1. Syncthing의 `source/changed-files/`를 Windows 로컬 AIMAX 작업 폴더에 복사한다.
2. `.env`, passphrase, keychain dump, decrypted secrets, user cookies, browser profile은 Syncthing에 두지 않는다.
3. Windows 로컬에서 아래 no-paid checks를 실행한다. `verify_schedule_publish_smoke.py`는 이 단계에서 컴파일만 확인하고, 라이브 실행은 하지 않는다.

```powershell
python -m py_compile app.py build.py content\ai_text.py paths.py posting\editor.py posting\publisher.py scripts\verify_schedule_publish_smoke.py
python scripts\preflight_split_drift.py
```

4. `image_count=0` server artifact/local runner 회귀를 반드시 확인한다. 서버가 이미 글 artifact를 주고 이미지 0장으로 요청된 경우 Windows runner가 3장 이미지 생성을 시도하지 않아야 한다.
5. 가능하면 Windows runner build를 수행한다.

```powershell
python build.py
```

6. 빌드 산출물이 있으면 설치 또는 실행 후 no-paid diagnostics/heartbeat만 확인한다. 유료 AI 생성, 이미지 생성, 네이버 발행/예약은 owner가 별도 승인하기 전까지 실행하지 않는다.
7. 실제 Naver editor smoke를 하게 되면 draft-save까지만 허용한다. publish/schedule/customer credentials 사용 금지. `scripts/verify_schedule_publish_smoke.py` 라이브 실행도 별도 승인 전까지 금지한다.

## Return expectations

Windows AI developer는 Syncthing 폴더에 아래를 남긴다.

- `WINDOWS_RESULT_20260602_deploy_fix_flow_cleanup_recheck.md`
- 실행한 명령과 pass/fail
- Windows 앱/빌드 버전
- 빌드 산출물 경로와 SHA256
- 실패 시 stage, visible error, sanitized logs
- 유료 API/발행/예약/고객 계정 사용 여부: 반드시 `none` 또는 승인 범위 기재
- Windows 버전은 기존 Windows canonical 값을 유지해도 된다. Mac build reference가 `v1.0.36`인 것과 Windows repo 버전이 다르면 결과에 그대로 기록하고, installer/version API rollout 전에 owner가 최종 버전을 정한다.

## Mac-side status for reference

- macOS source py_compile: pass
- `python scripts/preflight_split_drift.py`: pass
- Oracle server JS syntax and web inline script parse: pass
- Yeri server generation no-paid mock/routing/paid-guard/real-test-guard smokes: pass
- macOS build: `dist/AIMAX-macos.dmg`
- macOS bundle version: `v1.0.36`
- DMG SHA256 after `image_count=0` rebuild: `8a8e930b8aff88012452fecf335b93b343d86e098b580822ba372df924679724`
- Oracle targeted deploy: `server.js` + `static/app.html` applied and service health OK.
- Mac real-use paid test: job `f75691ee-bcf3-44cd-8b7b-85651366beb3`, demo account, Claude artifact `claude-sonnet-4-6`, draft-save only, no publish/schedule/customer credentials, final status `done`.
- Mac paid test evidence: text usage 419 input / 505 output tokens, estimated KRW 14; image attempted/generated/inserted all `0`.
- Oracle temporary `AIMAX_YERI_SERVER_GENERATION_REAL_TEST_ONLY=1` was restored to `0` after the test.

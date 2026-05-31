너는 AIMAX Windows 환경의 Windows Codex 개발자다.

이번 작업은 `R3-H Image Failure Diagnostics`다. Syncthing 공유 폴더에서 아래 문서를 먼저 읽어라.

```text
WINDOWS_CONTINUOUS_TIKITAKA_PROTOCOL.md
WINDOWS_HANDOFF_20260526_r3h_image_failure_diagnostics.md
```

중요:

- Syncthing 폴더 안에서 빌드하지 말고, 반드시 로컬 Windows 작업 폴더로 복사해서 작업한다.
- `.env`, 쿠키, 브라우저 프로필, 고객 계정, raw 로그, secrets/passphrases는 Syncthing에 절대 넣지 않는다.
- 이번 Windows readiness 작업에서는 paid AI/OpenAI/Gemini image call, Apify, Naver 발행/예약/수정/임시저장을 절대 실행하지 않는다.

해야 할 일:

1. `r3h_changed_files_mac_source.zip`을 참고해서 Windows 작업 소스에 같은 로직을 적용한다.
2. Windows release version을 `v1.0.23`으로 맞춘다.
3. R3-G 빈 이미지 프롬프트 보정 로직은 유지한다.
4. `posting/editor.py`의 `_input_image(...)`가 이미지 실패를 구조화해서 반환하게 한다.
   - `image_prompt_empty`
   - `image_generation`
   - `image_upload`
   - `image_insert_exception`
   - `image_inserted`
5. `input_content(...)`가 `image_failures`와 `image_results`를 집계하게 한다.
6. `app.py`, `split_version/app.py`가 이미지 삽입 부족 시 `failed_stage`를 좁은 이미지 단계로 남기고, `result.images.failures`와 `failed_posts[].images.failures`를 보존하게 한다.
7. diagnostics에는 API key, cookie, password, signed URL, 고객 정보가 들어가면 안 된다.

검증:

```text
python -m py_compile aimax_compliance.py split_version\aimax_compliance.py app.py split_version\app.py posting\editor.py scripts\smoke_yeri_image_failure_diagnostics.py
python scripts\smoke_yeri_image_failure_diagnostics.py
python scripts\verify_editor_image_provider_contract.py
```

기대 출력:

```text
R3H_YERI_IMAGE_FAILURE_DIAGNOSTICS_OK
EDITOR_IMAGE_PROVIDER_CONTRACT_OK
```

빌드:

- Windows runner package를 `v1.0.23`으로 빌드한다.
- 설치 또는 frozen runtime diagnostics를 실행한다.
- 다음을 확인한다.

```text
version == v1.0.23
frozen runtime == true
ai_text_import_smoke.ok == true
browser_version_detection.ok == true
```

완료하면 같은 Syncthing 폴더에 아래 파일들을 반환한다.

```text
WINDOWS_RESULT_20260526_r3h_image_failure_diagnostics.md
aimax_r3h_v123_image_failure_diagnostics_diag.json
aimax-bundle-windows.exe
NEXT_TRIGGER_20260526_r3h_image_failure_diagnostics.json
```

`NEXT_TRIGGER_20260526_r3h_image_failure_diagnostics.json`은 pass 시 반드시 아래 구조로 작성한다.

```json
{
  "verdict": "pass",
  "phase": "r3h_image_failure_diagnostics",
  "next_recommended_action": "mac_verify_windows_r3h_then_prepare_rollout_or_r3i",
  "requires_mac_action": true,
  "requires_windows_action": false,
  "safe_to_continue_without_user": true,
  "requires_user_approval": false,
  "versions": {
    "windows": "v1.0.23"
  },
  "artifacts": [
    "WINDOWS_RESULT_20260526_r3h_image_failure_diagnostics.md",
    "aimax_r3h_v123_image_failure_diagnostics_diag.json",
    "aimax-bundle-windows.exe"
  ],
  "forbidden_actions_confirmed": {
    "paid_ai": true,
    "apify": true,
    "naver_publish_or_schedule": true,
    "customer_credentials": true,
    "shared_secrets": true
  },
  "notes": "Windows R3-H no-paid verification and package build passed."
}
```

막히면 `verdict: "blocked"`로 바꾸고, blocker를 좁고 구체적으로 적어서 반환한다.

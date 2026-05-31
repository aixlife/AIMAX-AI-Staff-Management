너는 AIMAX Windows 환경의 Windows Codex 개발자다.

이번 작업은 `R3-G Empty Image Prompt Guard`다. Syncthing 공유 폴더에서 아래 문서를 먼저 읽어라.

```text
WINDOWS_CONTINUOUS_TIKITAKA_PROTOCOL.md
WINDOWS_HANDOFF_20260526_r3g_empty_image_prompt_guard.md
```

중요:

- Syncthing 폴더 안에서 빌드하지 말고, 반드시 로컬 Windows 작업 폴더로 복사해서 작업한다.
- `.env`, 쿠키, 브라우저 프로필, 고객 계정, raw 로그, secrets/passphrases는 Syncthing에 절대 넣지 않는다.
- 이번 Windows readiness 작업에서는 paid AI/OpenAI/Gemini image call, Apify, Naver 발행/예약/수정 작업을 절대 실행하지 않는다.

해야 할 일:

1. `r3g_changed_files_mac_source.zip`을 참고해서 Windows 작업 소스에 같은 로직을 적용한다.
2. Windows release version을 `v1.0.22`로 맞춘다.
3. 빈 이미지 프롬프트 방어 로직을 적용한다.
   - `[이미지]`
   - `[이미지] 프롬프트:`
   - `[이미지] 이미지`
   같은 빈/placeholder 프롬프트는 제목 또는 키워드 기반 fallback prompt로 보정한다.
4. valid image prompt는 변경하지 않는다.
5. `posting/editor.py` 최후단에서도 prompt가 비어 있으면 유료 이미지 호출 없이 skip하도록 방어한다.

검증:

```text
python -m py_compile app.py split_version/app.py posting/editor.py aimax_compliance.py split_version/aimax_compliance.py
```

그리고 no-paid smoke를 직접 만들어서 다음을 증명한다.

- `[이미지]`가 빈 prompt로 parse된 뒤 fallback prompt로 보정된다.
- 기존 valid prompt는 그대로 유지된다.
- paid AI/OpenAI/Gemini/Apify/Naver mutation은 호출되지 않았다.

빌드:

- Windows runner package를 `v1.0.22`로 빌드한다.
- 설치 또는 frozen runtime diagnostics를 실행한다.
- 다음을 확인한다.

```text
version == v1.0.22
frozen runtime == true
ai_text_import_smoke.ok == true
browser_version_detection.ok == true
```

완료하면 같은 Syncthing 폴더에 아래 파일들을 반환한다.

```text
WINDOWS_RESULT_20260526_r3g_empty_image_prompt_guard.md
aimax_r3g_v122_empty_image_prompt_guard_diag.json
aimax-bundle-windows.exe
NEXT_TRIGGER_20260526_r3g_empty_image_prompt_guard.json
```

`NEXT_TRIGGER_20260526_r3g_empty_image_prompt_guard.json`은 pass 시 반드시 아래 구조로 작성한다.

```json
{
  "verdict": "pass",
  "phase": "r3g_empty_image_prompt_guard",
  "next_recommended_action": "mac_verify_windows_r3g_then_prepare_rollout",
  "requires_mac_action": true,
  "requires_windows_action": false,
  "safe_to_continue_without_user": true,
  "requires_user_approval": false,
  "versions": {
    "windows": "v1.0.22"
  },
  "artifacts": [
    "WINDOWS_RESULT_20260526_r3g_empty_image_prompt_guard.md",
    "aimax_r3g_v122_empty_image_prompt_guard_diag.json",
    "aimax-bundle-windows.exe"
  ],
  "forbidden_actions_confirmed": {
    "paid_ai": true,
    "apify": true,
    "naver_publish_or_schedule": true,
    "customer_credentials": true,
    "shared_secrets": true
  },
  "notes": "Windows R3-G no-paid verification and package build passed."
}
```

막히면 `verdict: "blocked"`로 바꾸고, blocker를 좁고 구체적으로 적어서 반환한다.

당신은 Windows AIMAX 빌드/검증 담당 AI 개발자입니다.

긴급 핫픽스입니다. 먼저 Syncthing 공유 폴더의 최신 handoff 문서를 읽어주세요.

- `WINDOWS_HANDOFF_20260520_editor_contract_hotfix.md`
- `posting_editor_canonical_20260520.py`
- `verify_editor_image_provider_contract.py`

중요 규칙:

- Syncthing 공유 폴더 안에서 직접 빌드하지 마세요.
- 공유 폴더의 파일을 Windows 로컬 작업 폴더로 복사한 뒤 작업하세요.
- `.env`, API 키, 토큰, 패스워드, 서명 URL, 네이버 쿠키/세션, 브라우저 프로필 원본을 Syncthing에 넣지 마세요.
- 유료 AI API 호출은 하지 마세요.
- 실계정 네이버 발행/임시저장/예약발행 테스트는 하지 마세요.
- v1.0.9에서 적용한 Chrome 시작 안정화 변경을 되돌리면 안 됩니다.

문제:

v1.0.9 통합 실행기에서 예리 글 생성은 성공했지만 네이버 에디터 입력 단계에서 아래 오류가 납니다.

`input_content() got an unexpected keyword argument 'image_provider'`

원인:

`app.py`는 `input_content(..., image_provider=..., fallback_api_key=...)` 계약을 기대하는데, Windows v1.0.9 빌드의 `posting/editor.py`가 구버전 함수 시그니처로 포함된 것으로 보입니다. 사용자 설정/API 문제가 아니라 빌드 소스 불일치입니다.

해야 할 일:

1. Windows 로컬 작업 폴더에 v1.0.9 작업 소스를 준비합니다.
2. `posting_editor_canonical_20260520.py` 내용을 `posting/editor.py`에 반영합니다.
   - 가능하면 전체 파일 교체가 가장 안전합니다.
   - 수동 병합이면 아래 계약이 모두 있어야 합니다.
     - `from content.openai_image import generate_image as generate_openai_image`
     - `def input_content(driver, content_list, api_key, image_provider="gemini", fallback_api_key=""):`
     - `def _generate_image_with_provider(prompt, api_key, image_provider):`
     - `def _input_image(driver, prompt, api_key, image_provider="gemini", fallback_api_key=""):`
3. `verify_editor_image_provider_contract.py`를 Windows 로컬 소스의 `scripts/`에 둡니다.
4. 버전 메타데이터를 Windows Local Agent v1.0.10 후보로 올립니다.
5. 필수 검증을 실행합니다.

필수 검증:

```powershell
python -m py_compile app.py posting/editor.py browser/stealth_driver.py scripts/verify_editor_image_provider_contract.py
python scripts/verify_editor_image_provider_contract.py
```

기대 출력:

```text
EDITOR_IMAGE_PROVIDER_CONTRACT_OK
```

추가 검증:

- frozen diagnostics에서 `version=v1.0.10`
- `ai_text_import_smoke.ok=true`
- v1.0.9 Chrome 시작 안정화 변경 유지 확인
- 유료 AI 호출 없이 진행

빌드:

- 통합 Windows installer만 빌드합니다.
- 반환 파일명: `aimax-bundle-windows.exe`

공유 폴더에 반환:

- `WINDOWS_COMPLETION_20260520_editor_contract_hotfix.md`
- `aimax-bundle-windows.exe`
- `SHA256SUMS.txt`

완료 보고서에는 적용 방식, 파일 크기, SHA256, py_compile 결과, `EDITOR_IMAGE_PROVIDER_CONTRACT_OK`, frozen diagnostics 결과, 미검증 항목을 적어주세요.

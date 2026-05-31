# Windows Handoff: v1.0.10 예리 에디터 함수 계약 핫픽스

작성일: 2026-05-20 KST
프로젝트: AIMAX AI Staff Management
대상 버전 후보: Windows Local Agent v1.0.10

## 긴급 배경

v1.0.9 통합 실행기 배포 후 고객이 즉시 새 오류를 보고했다.

- 보고 ID: `AIMAX-RPT-20260520021900-587c9a8c`
- 사용자 메시지: "오류 밖에 안뜨는데 답변은 느리고 언제 사용하라는걸까요"
- 실행기: Windows v1.0.9
- 모델: Gemini 2.5 Flash
- 실패 단계: `smart_editor_input`
- 오류:

```text
input_content() got an unexpected keyword argument 'image_provider'
```

진단상 Gemini Flash 글 생성은 성공했고, 네이버 에디터 본문 입력 직전에 내부 Python 함수 호출이 깨졌다. 즉 사용자 API 설정 문제가 아니라 Windows v1.0.9 빌드의 소스 결합 문제다.

## 원인

`app.py` 호출부는 다음 계약을 기대한다.

```python
input_content(
    driver,
    content_list,
    image_api_key,
    image_provider=image_provider,
    fallback_api_key=fallback_image_api_key,
)
```

하지만 Windows v1.0.9 실행기 내부의 `posting/editor.py`는 `input_content()`가 `image_provider` 키워드 인자를 받지 못하는 구버전이 포함된 것으로 보인다.

Mac canonical source의 `posting/editor.py`는 이미 올바른 계약이다.

- `def input_content(driver, content_list, api_key, image_provider="gemini", fallback_api_key=""):`
- `def _input_image(driver, prompt, api_key, image_provider="gemini", fallback_api_key=""):`
- `def _generate_image_with_provider(prompt, api_key, image_provider):`
- `from content.openai_image import generate_image as generate_openai_image`

## 포함 산출물

- `posting_editor_canonical_20260520.py`
  - Mac canonical `posting/editor.py` 전체 파일
  - SHA256: `9a917ee51db1b5112ff92f6cea83b6d7436448df736388548741ce3b50a26bc8`
- `verify_editor_image_provider_contract.py`
  - 함수 계약 검증 스크립트
  - SHA256: `8f519386c87403bd64ab54b333c393e5d8233ee7d4ed5575420aed63302f3e8e`

## Windows 작업 지시

1. Syncthing 공유 폴더 안에서 빌드하지 말고 Windows 로컬 작업 폴더로 복사한다.
2. v1.0.9에 적용했던 Chrome 시작 안정화 변경을 유지한 상태에서 작업한다.
3. `posting_editor_canonical_20260520.py` 내용을 Windows 로컬 소스의 `posting/editor.py`에 반영한다.
   - 가능하면 전체 파일 교체가 가장 안전하다.
   - 수동 병합 시 반드시 위 4개 계약 항목을 모두 확인한다.
4. `verify_editor_image_provider_contract.py`를 Windows 로컬 소스의 `scripts/` 또는 루트에서 실행 가능하게 둔다.
5. 버전 메타데이터를 v1.0.10 후보로 올린다.
6. 통합 Windows installer만 빌드한다.

## 필수 검증

유료 AI 호출 금지. 실계정 발행/임시저장 금지.

필수 명령:

```powershell
python -m py_compile app.py posting/editor.py browser/stealth_driver.py scripts/verify_editor_image_provider_contract.py
python scripts/verify_editor_image_provider_contract.py
```

기대 출력:

```text
EDITOR_IMAGE_PROVIDER_CONTRACT_OK
```

추가 smoke:

- frozen diagnostics에서 `version=v1.0.10` 확인
- `ai_text_import_smoke.ok=true` 유지
- v1.0.9 Chrome 시작 안정화 변경이 사라지지 않았는지 확인
- `input_content` 계약 검증이 frozen/onedir 환경에서도 통과하는지 확인

## 완료 보고

공유 폴더에 다음 파일을 남긴다.

- `WINDOWS_COMPLETION_20260520_editor_contract_hotfix.md`
- `aimax-bundle-windows.exe`
- `SHA256SUMS.txt`

완료 보고서에는 다음을 포함한다.

- 적용 방식: 전체 파일 교체인지 수동 병합인지
- 빌드 파일 크기와 SHA256
- py_compile 결과
- `EDITOR_IMAGE_PROVIDER_CONTRACT_OK` 결과
- frozen diagnostics 결과
- 수행하지 않은 항목
- blocker가 있으면 재현 로그

## 운영 반영 계획

Windows v1.0.10 산출물이 오면 Mac/Oracle 쪽에서 다음을 수행한다.

- Oracle `aimax-bundle-windows.exe` 교체
- Windows latest/min을 v1.0.10으로 상향
- `AIMAX-RPT-20260520021900-587c9a8c`를 `waiting_user`로 변경하고 v1.0.10 업데이트 안내 남기기

## 고객 배려 메모

이 오류는 고객 설정 문제가 아니다. 글 생성 비용이 이미 소액 발생했으므로, 수정본 안내 전까지 같은 키워드로 반복 실행하지 않도록 안내해야 한다.

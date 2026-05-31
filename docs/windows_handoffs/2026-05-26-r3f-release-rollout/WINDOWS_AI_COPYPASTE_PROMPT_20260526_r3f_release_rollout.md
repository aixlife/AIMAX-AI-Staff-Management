# Windows Codex Copy-Paste Prompt - R3-F Release Rollout Readiness

너는 Windows 환경 AIMAX 실행기 담당 Codex다. 이번 작업은 **실제 유료 E2E 재실행이 아니라 배포 준비 확인**이다.

## 먼저 읽기

Syncthing 공유 폴더에서 아래 문서를 먼저 읽어:

```text
WINDOWS_HANDOFF_20260526_r3f_release_rollout.md
```

작업은 반드시 로컬 Windows 작업 폴더에서 진행하고, Syncthing 공유 폴더 안에서 빌드하지 마.

## 배경

Windows `v1.0.21`은 이미 실제 설치본 E2E를 통과했다.

성공 기준:

- NID 루프 탈출 PASS
- fresh login fallback PASS
- Smart Editor 진입 PASS
- 제목/본문 입력 PASS
- 이미지 1장 생성/삽입 PASS
- 임시저장 PASS
- 발행/예약 없음

이번 작업은 이 성공한 `v1.0.21` 설치본을 공식 배포 후보로 확정하고, Mac 쪽에서 Oracle 업로드/버전 API 변경을 이어갈 수 있게 파일과 보고서를 준비하는 것이다.

## 할 일

1. Windows `v1.0.21` 최종 빌드/설치 후보가 실제 E2E를 통과한 코드/설치본과 같은지 확인해.
2. 최종 업로드용 설치파일을 이 공유 폴더에 아래 이름으로 넣어:

```text
aimax-bundle-windows.exe
```

3. SHA256을 계산해.
4. 설치본 diagnostics를 다시 확인해.
5. 아래 두 파일을 반환해:

```text
WINDOWS_RESULT_20260526_r3f_release_rollout.md
aimax_r3f_v121_release_ready_diag.json
```

## 보고서 필수 내용

보고서에는 반드시 포함:

- verdict: `pass` 또는 `blocked`
- release version: `v1.0.21`
- 이 설치본이 실제 E2E 통과본과 같은지 여부
- 최종 설치파일 이름
- 최종 설치파일 SHA256
- installed diagnostics 결과
- `system.app.version`
- `system.runtime.frozen`
- `ai_text_import_smoke.ok`
- `browser_version_detection.ok`
- 이번 배포 준비 작업에서 유료 AI 호출 없음
- Apify 없음
- Naver 새 작업/발행/예약/수정 없음
- 고객 계정/고객 credentials 없음

## 금지

- 유료 AI 호출 금지
- 새 job 생성/claim/실행 금지
- Apify 금지
- Naver 발행/예약 금지
- 고객 계정 사용 금지
- secrets/token/cookie/browser profile/raw private log를 공유 폴더에 저장 금지

## 완료 후

파일을 공유 폴더에 넣고 완료라고 알려줘. Mac-side Codex가 자동 모니터로 받아서 다음 배포 게이트를 진행할 준비를 해둘 것이다.

# AIMAX Windows Transfer via Syncthing

이 폴더는 Windows AI 개발자에게 AIMAX 최신 작업물을 빠르게 전달하기 위한 Syncthing 전달 폴더다.

## 사용 원칙

- 이 폴더는 작업 폴더가 아니라 전달 폴더다.
- Windows에서는 zip을 새 로컬 작업 폴더에 풀어서 빌드한다.
- 기존 `NaverBlogAuto-main-wincheck` stale 폴더를 그대로 빌드하지 않는다.
- encrypted secrets는 전달해도 되지만 passphrase는 같은 폴더에 두지 않는다.
- 빌드 산출물은 Windows 쪽에서 별도 `outbox` 또는 새 날짜 폴더로 돌려보낸다.

## 포함 파일

- `aimax-l1j-windows-transfer-20260506.zip`
  - 최신 source zip
  - encrypted test secrets
  - 복호화 안내 README
- `aimax-l1j-windows-transfer-20260506.sha256`
  - source zip, encrypted secrets, transfer zip SHA-256

## 별도 전달

복호화 passphrase는 macOS 프로젝트의 아래 파일에만 있다.

```text
handoff/aimax-l1j-test-secrets-20260506.passphrase.local-only.txt
```

이 파일은 Syncthing 폴더에 넣지 않는다. Windows 작업자에게는 별도 채널로만 전달한다.

## Windows AI 첫 작업

1. `aimax-l1j-windows-transfer-20260506.zip`을 새 작업 폴더에 푼다.
2. 내부 `aimax-l1j-windows-source-20260506.zip`을 다시 푼다.
3. `docs/windows_build_v1_0_1_handoff.md`를 먼저 읽는다.
4. `docs/windows_ai_build_prompt.md`의 순서대로 진행한다.
5. 완료 보고와 산출물을 새 날짜 폴더로 Syncthing에 다시 올린다.


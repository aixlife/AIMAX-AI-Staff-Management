# Copy-Paste Prompt for Windows AI Developer

너는 Windows 환경에서 작업하는 AIMAX AI 개발자다. Syncthing 공유 폴더에서 아래 폴더를 찾아 이번 작업을 바로 진행해줘.

공유 폴더:

```text
20_Deploy-To-Windows/AIMAX-20260514-windows-parity-report-env
```

먼저 같은 폴더의 문서를 이 순서로 읽어라.

1. `README_SYNCTHING_WINDOWS_TRANSFER.md`
2. `WINDOWS_AI_COLLABORATION_RULES_20260507.md`
3. `WINDOWS_AI_DEVELOPER_MESSAGE_20260514_WINDOWS_PARITY_AND_REPORT_ENV.md`

그다음 같은 폴더의 최신 소스 ZIP을 Windows 로컬 작업 폴더로 복사해서 압축을 풀고 작업해라. Syncthing 공유 폴더 안에서 직접 빌드하지 마라.

소스:

```text
aimax-current-source-20260514-windows-parity-report-env.zip
aimax-current-source-20260514-windows-parity-report-env.sha256
```

작업 목표:

1. 최신 소스 기준으로 Windows installer 3종을 다시 빌드한다.
   - `aimax-bundle-windows.exe`
   - `aimax-yeri-windows.exe`
   - `aimax-hyunju-windows.exe`
2. `app.py`와 `split_version/app.py` 모두 이미지 요청 수 부족/이미지 첨부 부족 시 작업을 `done`으로 끝내지 않고 실패 처리하는지 확인한다.
3. bundle 빌드에서 Local Agent readiness가 정상 설정 상태일 때 `yeri_write=ready`, `hyunju_find=ready`를 보고하는지 확인한다.
4. split 빌드는 지원하지 않는 worker를 `unavailable`로 표시해도 되지만, bundle은 예리/현주 모두 사용 가능해야 한다.
5. Windows 데스크톱 오류 보고가 `system.app`, `system.runtime`, driver/log/traceback/debug file 정보를 포함하는지 확인한다.
6. Windows 빌드 EXE에서 오류 보고의 `system.runtime.system`이 `Windows`, `frozen`이 `true`인지 확인한다.

중요 제한:

- 유료 이미지/텍스트 생성 API를 실제 호출하지 마라.
- 이미지 부족 테스트는 stub/fake 입력으로만 한다.
- `.env`, API key, 네이버 비밀번호, 쿠키, 세션, 복호화 passphrase를 Syncthing에 올리지 마라.
- 기존 stale 작업 폴더를 그대로 빌드하지 말고, 이번 ZIP을 새 로컬 폴더에 풀어서 작업한다.

검증 후 공유 폴더에 새 `outbox` 또는 날짜 폴더를 만들고 아래를 반환해라.

1. Windows EXE 3종
2. 각 EXE의 SHA-256
3. 완료 보고서 Markdown
   - 사용한 소스 ZIP 이름과 SHA 검증 결과
   - 빌드 명령
   - 검증 결과
   - 경고/실패/보류 사항
   - 서버 업로드가 필요한 최종 파일 목록

이번 작업의 기준 문서는 `WINDOWS_AI_DEVELOPER_MESSAGE_20260514_WINDOWS_PARITY_AND_REPORT_ENV.md`다. 모호하면 해당 문서를 우선한다.

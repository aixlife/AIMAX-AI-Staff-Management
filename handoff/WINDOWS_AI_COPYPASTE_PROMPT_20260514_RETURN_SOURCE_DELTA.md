# Copy-Paste Prompt for Windows AI Developer - Return Source Delta

너는 Windows 환경에서 작업하는 AIMAX AI 개발자다. 방금 반환한 Windows EXE 3종은 Mac 쪽에서 확인했고, 파일 구성과 SHA-256은 정상으로 확인됐다.

확인된 outbox:

```text
20_Deploy-To-Windows/AIMAX-20260514-windows-parity-report-env/outbox-20260514-1443-windows-parity-report-env
```

확인된 EXE SHA-256:

```text
aimax-bundle-windows.exe  33b4aa501f46738ef1eeea5a2a6ba13839d6464800bf4ce60afcdc27c83b343e
aimax-yeri-windows.exe    afddf37046ae9d7b20663543aeca2528ca0664804b024c8326cc9bbc4bb29ec7
aimax-hyunju-windows.exe  990a4f4aedfd96c055a21cbf41cf74e2a699085a1c9a9cc22bee1d4e7a123fdb
```

다만 완료 보고서에 따르면 빌드 중 아래 파일들에 `--diagnostics-probe <path>` 숨은 진단 CLI를 추가했다고 되어 있다.

```text
app.py
split_version/app.py
split_version/app_find.py
split_version/app_engage_write.py
```

문제는 이 Windows 로컬 변경분의 patch/source delta가 outbox에 포함되어 있지 않다는 점이다. 운영 배포 전에 빌드 재현성을 맞춰야 하므로 아래 둘 중 하나로 처리해줘.

## 우선 처리 옵션 A - 권장

현재 반환한 EXE 3종에 실제로 들어간 로컬 변경분을 patch로 만들어 같은 outbox 또는 새 outbox에 추가해라.

필수 반환 파일:

```text
windows-source-delta-20260514-diagnostics-probe.patch
WINDOWS_AI_STATUS_20260514_source_delta.md
```

patch에는 아래 파일의 변경분만 포함해야 한다.

```text
app.py
split_version/app.py
split_version/app_find.py
split_version/app_engage_write.py
```

상태 보고서에는 아래를 명시해라.

1. 이 patch가 방금 반환한 EXE 3종에 포함된 변경분과 정확히 동일한지 여부
2. `--diagnostics-probe`가 일반 사용자 실행 경로에 영향을 주지 않는지 여부
3. 네트워크 호출, 유료 API 호출, 네이버 발행을 하지 않는 검증용 기능인지 여부
4. 이 probe를 운영 소스에 남겨도 되는지, 아니면 검증 후 제거하는 것이 맞는지 너의 판단
5. patch 적용 후 필요한 검증 명령과 결과

## 대체 처리 옵션 B

만약 방금 만든 EXE와 정확히 같은 source delta를 제공할 수 없다면, `--diagnostics-probe` 변경을 제거하고 원래 전달받은 source ZIP 기준으로 다시 빌드해라.

이 경우 새 outbox에 다시 반환해라.

필수 반환 파일:

```text
aimax-bundle-windows.exe
aimax-yeri-windows.exe
aimax-hyunju-windows.exe
SHA256SUMS.txt
WINDOWS_AI_STATUS_20260514_rebuild_without_probe.md
```

그리고 보고서에 아래를 명시해라.

1. probe 없이 다시 빌드했는지
2. 이미지 프롬프트 부족/이미지 첨부 부족 실패 처리는 여전히 통과하는지
3. bundle readiness가 `yeri_write=ready`, `hyunju_find=ready`인지
4. split readiness가 지원하지 않는 worker를 `unavailable`로 표시하는지
5. 데스크톱 오류 보고 환경 정보는 Windows에서 어떤 방식으로 검증했는지
6. 유료 API 호출과 실 Naver 발행은 하지 않았는지

## 중요 제한

- Syncthing 공유 폴더 안에서 직접 빌드하지 마라.
- `.env`, API key, 네이버 비밀번호, 쿠키, 세션, 복호화 passphrase를 공유 폴더에 올리지 마라.
- 유료 이미지/텍스트 생성 API를 실제 호출하지 마라.
- 실 Naver 발행 테스트를 하지 마라.

이번 요청의 목적은 “EXE가 정상인지”가 아니라 “운영 배포 전에 EXE를 만든 소스 변경분을 재현 가능하게 확보하는 것”이다.

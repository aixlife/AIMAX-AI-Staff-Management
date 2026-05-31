Windows AIMAX 작업 이어서 진행해주세요.

공유 폴더의 최신 문서를 먼저 읽어주세요:

- `WINDOWS_AI_DEVELOPER_MESSAGE_20260518_UNIFIED_LAUNCHER_GUARD.md`
- `aimax-unified-launcher-guard-source-20260518.zip`
- `aimax-unified-launcher-guard-source-20260518.zip.sha256`

작업 목표:

Windows `v1.0.6`으로 통합 실행기 가드를 구현/검증/재빌드해주세요. 현재 문제는 통합 권한 계정이 split 실행기에 연결되면 웹앱에서 예리 또는 현주가 `unavailable`로 보여 사용자가 매우 혼란스러워진다는 점입니다.

필수 요구:

1. bundle 계정 + 통합 실행기에서는 `yeri_write`, `hyunju_find` 모두 정상 제공되어야 합니다.
2. bundle 계정 + split 실행기에서는 조용히 split heartbeat를 보내지 말고, 명확한 안내를 띄우거나 통합 실행기로 forward/open 해야 합니다.
3. `aimax://agent/connect`는 통합 앱이 설치되어 있으면 split 앱에 빼앗기지 않게 해주세요.
4. split 설치파일을 bundle 이후 설치해도 프로토콜을 훔치지 않거나, 훔치더라도 bundle 계정에서는 통합 앱으로 forward 되어야 합니다.
5. Windows runtime/installer version은 `v1.0.6`으로 올려주세요.
6. v1.0.5의 native Go launcher, open_settings 안정화, Yeri import/init fix는 유지해야 합니다.

검증:

- 실제 발행/유료 모델 호출 없이 mock 또는 no-publish로 검증하세요.
- bundle 계정 + bundle 실행기: `yeri_write=ready`, `hyunju_find=ready`
- bundle 계정 + Yeri split 실행기: 통합 실행기 안내/forward, misleading heartbeat 금지
- bundle 계정 + Hyunju split 실행기: 통합 실행기 안내/forward, misleading heartbeat 금지
- split 먼저 설치 후 bundle 설치: protocol bundle 우선
- bundle 먼저 설치 후 split 설치: protocol bundle 유지 또는 split이 bundle로 forward
- `aimax://agent/connect` 반복 호출 시 단일 인스턴스 유지
- `open_settings` 회귀 없음

반환 파일:

- `WINDOWS_AI_COMPLETION_REPORT_20260518_UNIFIED_LAUNCHER_GUARD.md`
- `windows-source-delta-20260518-unified-launcher-guard-v106.patch`
- `aimax-bundle-windows.exe`
- `aimax-yeri-windows.exe`
- `aimax-hyunju-windows.exe`
- `SHA256SUMS.txt`
- `aimax-windows-unified-launcher-guard-evidence-20260518.json`

주의:

- 공유 폴더 안에서 빌드하지 말고, 로컬 Windows 작업 폴더로 복사해서 작업하세요.
- 제공된 source ZIP을 로컬 Windows 작업 폴더에 풀고, 기존 v1.0.5 작업본이 있다면 차이를 확인한 뒤 진행하세요.
- secrets/passphrases/tokens/API keys는 공유 폴더에 넣지 마세요.
- 완료 보고서에는 변경 파일, SHA256, 검증 결과, 잔여 리스크를 적어주세요.

# 지은 macOS Tauri 다운로드 배포 준비 - 2026-07-01

## Summary

- 지은 macOS Tauri 앱을 사용자가 받을 수 있는 DMG 형태로 패키징했다.
- DMG를 AIMAX 배포 후보 폴더 `dist/upload_installers/`에 배치했다.
- AIMAX 서버/웹 카탈로그가 지은의 Windows/Mac 다운로드 옵션을 함께 노출하도록 소스를 준비했다.
- 운영 서버 업로드와 웹 배포는 아직 실행하지 않았다.

## DMG Artifact

- 파일: `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/dist/upload_installers/AIMAX-Office-Manager-macOS-0.2.0-aarch64.dmg`
- 크기: 36 MB
- SHA256: `4f509535844595cf0d7d8c84b3c1d701b27d989d30b74695feacb1838e536a1b`
- 대상: Apple Silicon macOS
- 앱 버전: `0.2.0`
- 번들 ID: `com.aimaxviseo.office`
- 최소 macOS: `12.0`

## Source Snapshot

- 최신 소스 스냅샷: `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/handoffs/2026-07-01-jieun-tauri-mac-port/aimax-viseo-tauri-macos-v020-distribution-source-20260701.tgz`
- SHA256: `b79cf0d79c1e164fa962e7439b9d7f88a7486183c3f8c7df02c67d6a4e7b84eb`
- 원본 작업 클론: `/private/tmp/aimax-viseo-tauri`
- 작업 브랜치: `feature/jieun-tauri-macos-v017`
- 원격 브랜치: `https://github.com/aixlife/aimax-viseo/tree/feature/jieun-tauri-macos-v017`
- 원격 커밋: `441c481 Add Tauri macOS distribution build`

## Distribution Changes Prepared

- `oracle/aimax-reports-api/server.js`
  - 지은 `supportedPlatforms`를 `["windows", "macos"]`로 확장
  - Windows Setup 다운로드와 Apple Silicon Mac DMG 다운로드를 `executionOptions`로 추가
  - public download whitelist에 `AIMAX-Office-Manager-macOS-0.2.0-aarch64.dmg` 추가
  - 다중 다운로드 옵션을 worker validation에서 인정하도록 수정
- `oracle/aimax-reports-api/static/app.html`
  - 지은 fallback catalog에 Windows/Mac 다운로드 옵션 추가
  - 외부 다운로드 직원의 기본 버튼이 현재 플랫폼에 맞는 다운로드 옵션을 선택하도록 수정
  - 현재 기기에서 지원하지 않는 실행 옵션은 비활성화
- `scripts/deploy_oracle.sh`
  - `external-staff` 모드가 지은 macOS DMG도 업로드 대상으로 포함하도록 수정

## Verification

- Tauri renderer build: passed
- Tauri app build: passed
- ad-hoc code signing: passed
- `codesign --verify --deep --strict`: passed
- DMG creation through `npm run tauri:build:mac-dmg`: passed
- DMG read-only mount: passed
- DMG contents verified:
  - `AIMAX Office Manager.app`
  - `Applications` symlink
- App copied from mounted DMG to `/private/tmp/jieun-install-test/`: passed
- Copied app code signing verification: passed
- Copied app launch: passed
- Launch screenshot: `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/handoffs/2026-07-01-jieun-tauri-mac-port/jieun-tauri-dmg-install-launch-20260701.png`
- `node --check oracle/aimax-reports-api/server.js`: passed
- `bash -n scripts/deploy_oracle.sh`: passed
- `oracle/aimax-reports-api/static/app.html` inline script parse: passed
- `scripts/deploy_oracle.sh external-staff --dry-run`: passed
  - report: `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/docs/deployments/oracle-deploy-20260701-195013.md`
- `scripts/deploy_oracle.sh web --dry-run`: passed
  - report: `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/docs/deployments/oracle-deploy-20260701-195013-1.md`

## Important Gate

- 현재 DMG는 ad-hoc signed 상태다.
- Tauri 공식 문서 기준, 브라우저에서 다운로드한 macOS 앱을 일반 사용자에게 경고 없이 열게 하려면 Developer ID Application 서명과 Apple notarization이 필요하다.
- 이 Mac에는 현재 유효한 code signing identity가 없다: `security find-identity -v -p codesigning` 결과 `0 valid identities found`.
- 따라서 지금 상태는 "다운로드/설치/실행 가능한 내부 알파 DMG"이며, "고객에게 경고 없이 배포 가능한 운영 DMG"는 Apple Developer 인증서와 notarization 정보가 들어와야 완료된다.

## Next Deploy Commands

운영 반영 전 최종 승인 후:

```bash
scripts/deploy_oracle.sh external-staff
scripts/deploy_oracle.sh web
```

운영 확인:

```bash
curl -I -L https://api.aimax.ai.kr/downloads/AIMAX-Office-Manager-macOS-0.2.0-aarch64.dmg
curl -sS -L https://api.aimax.ai.kr/api/workers | rg "AIMAX-Office-Manager-macOS|macos|jieun"
```

## Remaining Work

1. Apple Developer ID 인증서와 notarization 자격 증명을 준비한다.
2. `APPLE_SIGNING_IDENTITY`, `APPLE_ID`/`APPLE_PASSWORD`/`APPLE_TEAM_ID` 또는 App Store Connect API env를 넣고 `NOTARIZE=1 npm run tauri:build:mac-dmg`로 운영 DMG를 만든다.
3. notarized DMG로 다시 mount/copy/launch 검증한다.
4. 운영 서버에 DMG와 웹 카탈로그를 배포한다.
5. 실제 `https://api.aimax.ai.kr/downloads/...dmg` 링크로 다운로드 후 설치/실행을 재검증한다.

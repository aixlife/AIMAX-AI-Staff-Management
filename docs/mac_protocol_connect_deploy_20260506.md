# Mac Protocol Connect Deploy 2026-05-06

## 목적

웹앱에서 로컬 실행기가 연결되지 않았을 때 `실행기 다운로드`만 보여주는 구조를 보완했다. 사용자는 한 번 최신 실행기를 설치한 뒤에는 업데이트가 필요한 경우를 제외하고 다시 설치 파일을 받을 필요 없이, 웹앱의 `실행기 연결` 버튼으로 로컬 실행기를 다시 열 수 있어야 한다.

## 반영 내용

- `oracle/aimax-reports-api/static/app.html`
  - `실행기 연결` 버튼 추가
  - 버튼 클릭 시 `aimax://agent/connect` 호출
  - 로컬 실행기가 꺼진 상태에서 `로컬 설정 열기`를 누르면 `aimax://agent/connect`를 호출
- `build.py`
  - macOS 통합 앱 `Info.plist`에 `CFBundleURLTypes` 추가
- `split_version/build_split.py`
  - 예리/현주 macOS 분리 앱 `Info.plist`에 `CFBundleURLTypes` 추가
- `local_agent/runtime.py`
  - 첫 실행 웹앱 연결 창 추가
  - 저장된 세션이 없을 때 웹앱 로그인 후 로컬 보안 설정으로 이어지는 흐름 추가
- `app.py`, `split_version/app.py`
  - `aimax://agent/connect` URL 인자가 들어와도 깨지지 않도록 `parse_known_args()` 적용

## 빌드 산출물

업로드용 위치:

- `dist/upload_installers/aimax-bundle-macos.dmg`
- `dist/upload_installers/aimax-yeri-macos.dmg`
- `dist/upload_installers/aimax-hyunju-macos.dmg`

SHA-256:

- `aimax-bundle-macos.dmg`: `7f3f7b2f3dc88b2d968e615bca8ea9548e2a9375567e46579e99952b1e6bcdfb`
- `aimax-yeri-macos.dmg`: `fc81d363146c4e045ba3ca8d752efc723622e662e0d8ec469b612c87f387f90c`
- `aimax-hyunju-macos.dmg`: `27b25ade025431646c1da3ea87d1cc58da93977de23eab72e630a8bd3612b494`

## 운영 배포

서버:

- host: `oracle-server`
- app: `/home/ubuntu/aimax-reports-api`
- downloads: `/home/ubuntu/aimax-downloads`

백업:

- `/home/ubuntu/aimax-backups/20260506-180755`

배포한 파일:

- `/home/ubuntu/aimax-reports-api/static/app.html`
- `/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg`
- `/home/ubuntu/aimax-downloads/aimax-yeri-macos.dmg`
- `/home/ubuntu/aimax-downloads/aimax-hyunju-macos.dmg`
- `/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe`
- `/home/ubuntu/aimax-downloads/aimax-yeri-windows.exe`
- `/home/ubuntu/aimax-downloads/aimax-hyunju-windows.exe`

서비스 재시작:

- `systemctl --user restart aimax-reports-api.service`
- 배포 후 서비스 상태: `active`

## 검증 결과

- Python compile: 통과
- `app.html` inline JS syntax check: 통과
- 통합/예리/현주 macOS 앱 `Info.plist`에 `CFBundleURLSchemes = aimax` 확인
- 업로드용 통합 DMG를 임시 마운트해 내부 `AIMAX.app`에도 `aimax` URL scheme이 포함됨을 확인
- 운영 웹앱 HTML 응답에서 `launchAgentBtn`, `aimax://agent/connect`, `실행기 연결` 확인
- 운영 API `/api/downloads/options`에서 macOS/Windows 설치 파일 6종 `exists: true` 확인
- `dist/AIMAX.app`를 LaunchServices에 테스트 등록 후 `open 'aimax://agent/connect'` 실행
- 운영 API `/api/agent/status`에서 Mac 연결 갱신 확인
  - `connected: true`
  - `version: v1.0.1`
  - `platform: Darwin 25.5.0 arm64`

Windows EXE SHA-256:

- `aimax-bundle-windows.exe`: `1a76850571cc76357ff6462d0c83d416d321cc77a5196112f1b124b4a64b82f4`
- `aimax-yeri-windows.exe`: `b027f6c202828b880e835a55873e9b33213508bf43896660f6662c67635072bd`
- `aimax-hyunju-windows.exe`: `679b944f54bf4068b2ff77a1d5987a298249b266b45e0900bc6871a6d6046fae`

## 운영 의미

- 신규 사용자는 최신 DMG/EXE를 한 번 설치해야 `aimax://` 연결이 동작한다.
- 최신 DMG/EXE 설치 후에는 실행기가 꺼져 있어도 웹앱의 `실행기 연결` 버튼으로 다시 열 수 있다.
- 업데이트가 필요한 경우에는 기존처럼 설치 파일 다운로드가 필요하다.
- 이미 오래된 실행기를 설치한 사용자는 이번 URL scheme이 앱에 없으므로 한 번 업데이트 설치가 필요하다.

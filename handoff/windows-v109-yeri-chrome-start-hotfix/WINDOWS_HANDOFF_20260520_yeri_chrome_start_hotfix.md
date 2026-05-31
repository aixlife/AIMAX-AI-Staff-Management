# Windows Handoff: 예리 Chrome 시작 실패 핫픽스 후보

작성일: 2026-05-20 KST
프로젝트: AIMAX AI Staff Management
대상 버전 후보: Windows Local Agent v1.0.9

## 배경

운영 오류 보고가 2026-05-20 01:03 KST 기준으로 정리되었다.

- 전체 오류 보고: 28건
- 상태: `done=11`, `waiting_user=9`, `working=8`
- `new` / `reviewing`: 0건

이번 Windows 작업의 핵심은 같은 번들 계정에서 반복된 예리 실행 실패다.

- `AIMAX-RPT-20260519151029-c51f8f7a`
- `AIMAX-RPT-20260518095126-d9a35540`
- `AIMAX-RPT-20260516150059-8879a9b5`
- `AIMAX-RPT-20260516161506-67741b89`
- `AIMAX-RPT-20260516164406-bc649df1`
- `AIMAX-RPT-20260516164517-8d41a79a`

운영 로그상 최신 v1.0.8 Windows 번들 실행기에서 예리 작업이 `browser_start` 단계에 실패했다.

대표 진단:

```text
Message: session [REDACTED] created: cannot connect to chrome at 127.0.0.1:50828
from chrome not reachable
stage: browser_start
```

같은 계정에서 현주 작업은 이후 완료 이력이 있으므로 실행기 전체 사망보다는 예리 작업의 Chrome 시작/앱 전용 브라우저 프로필 복구 문제가 우선 후보다.

## 포함 산출물

- `windows-source-delta-20260520-yeri-chrome-start-hotfix.patch`
  - 수정 대상: `browser/stealth_driver.py`
  - Mac 기준 소스에서 생성한 명시적 패치

## 적용 범위

`browser/stealth_driver.py`에 다음 복구를 추가한다.

- Windows에서도 앱 전용 Chrome 프로필을 물고 있는 `chrome` / `chromedriver` 프로세스를 탐지한다.
- 앱 전용 프로필 프로세스만 `taskkill`로 정리한다.
- `chrome not reachable`, `cannot connect to chrome`, `session not created`, `DevTools` 계열 브라우저 시작 실패 시:
  - 프로필 잠금 파일을 정리한다.
  - 손상 가능성이 있는 앱 전용 프로필을 `.recover-YYYYMMDDHHMMSS`로 백업한다.
  - 새 프로필 디렉토리로 한 번 더 Chrome 시작을 재시도한다.

사용자 일반 Chrome 프로필을 건드리지 않도록 `--user-data-dir=<AIMAX app data browser_profiles/...>`를 포함한 프로세스만 대상으로 해야 한다.

## Windows 작업 지시

1. Syncthing 공유 폴더 안에서 직접 빌드하지 말고, Windows 로컬 작업 폴더로 소스를 복사한다.
2. 최신 handoff 문서를 먼저 읽고, 이 문서의 패치를 Windows 로컬 작업 폴더에 적용한다.
3. Windows Local Agent 버전을 v1.0.9 후보로 올릴지 확인하고, 기존 배포 규칙에 맞춰 버전 메타데이터를 맞춘다.
4. 최소 검증을 수행한다.
   - `python -m py_compile browser/stealth_driver.py`
   - no-paid smoke: 앱 전용 임시 프로필로 `create_stealth_driver(profile_key="chrome_start_smoke")` 실행, `about:blank` 진입, `quit()`
   - v1.0.8에서 남아 있던 앱 전용 프로필/Chrome 프로세스가 있을 때도 새 시작이 복구되는지 확인
   - 예리 작업은 유료 AI 호출 없이 mock 또는 키워드 1개/임시저장 dry-run 경로만 사용
5. Windows 설치 파일을 빌드한다.
   - 통합 번들 우선
   - 기존 배포 호환을 위해 yeri/hyunju 분리 설치 파일도 현재 운영 방식에 맞춰 빌드할지 확인
6. 산출물을 공유 폴더로 반환한다.

## 검증 기준

- Windows에서 `browser_start` 단계의 `cannot connect to chrome` 재현 케이스가 프로필 정리 후 복구된다.
- 실패가 계속될 경우 최종 오류 메시지에 "Chrome 프로필/디버그 연결 복구 후에도 시작할 수 없습니다"가 남아 운영자가 원인을 구분할 수 있다.
- 앱 전용 프로필 외 사용자 일반 Chrome 프로필/브라우저 세션은 종료하지 않는다.
- 유료 AI API 호출 없이 검증한다.
- 빌드 결과물의 파일명, 크기, SHA256, 실행 smoke 결과를 남긴다.

## 완료 보고 형식

공유 폴더에 다음을 남긴다.

- `WINDOWS_COMPLETION_20260520_yeri_chrome_start_hotfix.md`
- 빌드 산출물 또는 산출물 위치
- SHA256/파일 크기
- 검증 로그 요약
- 막힌 점이 있으면 blocker와 재현 로그

## 후속 운영

Windows 빌드/검증 완료 후 Mac/운영 쪽에서 해야 할 일:

- Oracle 다운로드 파일 교체
- `/api/version` Windows latest/min을 v1.0.9로 업데이트
- 위 예리 Chrome 시작 실패 보고들을 `waiting_user`로 바꾸고 v1.0.9 업데이트 안내 남기기
- 다운로드 실패 보고(`AIMAX-RPT-20260519111502-f4464f9a`)는 별도 웹 다운로드 경로 보강 여부 확인

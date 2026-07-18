# 맥스 윈도우 Tauri 전환 라운드 (2026-07-18)

## 한 줄 요약
윈도우 Electron→Tauri 전환을 전부 구현하고, 실제 플릿과 동일한 조건(Electron 0.1.17 + 데이터 + 자동시작)을 재현한 AIXLIFE에서 전환 설치 체인·데이터 마이그레이션·사일런트 자동업데이트까지 전 항목 실측 PASS. 남은 것은 민수 시각 실기와 릴리스 게시(CEO 게이트)뿐.

## 선결 확인 3건 답 (전부 실측)

### 1. Tauri NSIS가 Electron 설치본을 대체하는가 — 된다
- 배포된 Electron v0.1.17은 electron-updater가 GitHub `maxalert-releases`의 latest.yml을 1시간마다 확인, sha512 검증 후 새 설치기를 `--updated /S --force-run`으로 실행 (소스 실독).
- 배포본 `app-update.yml`에 publisherName 없음 → 서명 검증 없이 무서명 Tauri NSIS 수용 (AIXLIFE 실물 확인).
- Electron 언인스톨 레지스트리 GUID `be734e16-…`는 appId에서 결정적 파생 — 전 머신 동일.
- 신규 `installer-hooks.nsh`: PREINSTALL=실행 중 앱 종료만 / POSTINSTALL=새 파일 설치 성공 후 Electron 언인스톨(동기, 종료코드 검사)+잔재 정리+바로가기 복원+RunAsUser 재실행. 설치 중간 실패 시 구버전이 살아남는 순서.

### 2. 데이터 마이그레이션 — 이미 구현돼 있었고, 원자화 보강
- Electron 데이터 `%APPDATA%\maxalert\maxalert-data.json` → Tauri `%APPDATA%\com.makefriends.maxalert\`로 Store::load가 첫 실행에 복사 (v0.2.1 리빌드 때 이미 구현).
- 이번에 보강: 복사 전 JSON 파싱 검증 + tmp→rename 원자 이관, 저장도 원자화(강제 종료 절단 방지).
- AIXLIFE 실측: 포인트 777·스트릭 7·totalDone 42 심어놓고 전환 → 전부 보존 확인.

### 3. 빌드 경로 — GH Actions 채택
- maxalert 리포는 PUBLIC(Actions 무료) + WRITE 권한, AIXLIFE에는 Rust 툴체인 없음(설치 7GB급).
- `.github/workflows/windows-nsis.yml`: mac/tauri push마다 NSIS 빌드 + latest.yml(sha512)+SHA256SUMS 아티팩트. 첫 빌드 7분 20초 성공. 릴리스 게시는 의도적으로 수동(사람 결정).
- 파트너도 이후 Rust 설치 없이 push→아티팩트→릴리스 업로드 흐름 유지 가능.

## 구현 내역 (mac/tauri 71f0e7e, push 완료)
- `src-tauri/installer-hooks.nsh` 신규 — 위 훅 설계.
- `lib.rs` — 윈도우 전용 사일런트 자동업데이트: 기존 latest.yml 채널 소비(6h 폴링), sha512(base64) 검증, 사이렌 발화 중 연기(10분 후 재시도), https/루프백 제한, `MAXALERT_UPDATE_URL` 실기 오버라이드, 랜덤 임시파일+create_new. 맥은 기존 카탈로그 배너 유지(cfg 분기).
- `store.rs` — 저장·마이그레이션 원자화.
- `Cargo.toml` — reqwest `rustls-tls-native-roots`+`system-proxy`(사내 CA·프록시 환경), sha2/base64 추가, 버전 0.2.2 정리.
- `tauri.conf.json` — windows nsis 번들(currentUser·installerHooks·Korean), WebView2 downloadBootstrapper silent.
- cargo test 18/18 PASS (신규 4: 매니페스트 파서·URL 결합·스킴 제한).

## Codex Sol 반박 리뷰 (13건) 판정
- 실측 기각: #2 서명 검증(publisherName 없음 실확인).
- 수용·반영: #3/#6/#9 설치 순서 재설계(제거를 POSTINSTALL로, rc 검사, 바로가기 복원), #4 spawn 후 자진 종료 제거(설치기 taskkill에 위임 — 설치기 조기 실패 시 앱 생존), #5 사이렌 발화 중 연기, #7/#8 저장·마이그레이션 원자화, #10 native roots+system proxy, #13 RunAsUser 재실행, #1/#11 부분(URL 스킴 제한, 랜덤 임시파일).
- 기각(사유 기록): WebView2 offlineInstaller(설치기 150MB 비대 — 플릿은 Win10/11 WebView2 기본 탑재), legacy 파일 rename(전환 실패 시 Electron 롤백 데이터 경로 보존이 우선 — 전환 안정화 후 재검토).

## AIXLIFE 실측 결과 (플릿 조건 재현 후)
| 항목 | 결과 |
|---|---|
| 전환 설치 (electron-updater 동일 인자 `--updated /S --force-run`) | PASS (exit 0) |
| Electron 제거 (GUID 키·`Programs\maxalert` 디렉토리) | PASS (완전 삭제) |
| Tauri 설치 (`AppData\Local\MaxAlert`, DisplayVersion 0.2.2, exe 27.5MB) | PASS |
| Electron 자동시작 Run 값 삭제 | PASS |
| 데이터 마이그레이션 (777포인트·스트릭7·totalDone42) | PASS |
| Tauri 자동시작 재적용 (openAtLogin=true 승계) | PASS |
| 바로가기 복원 (바탕화면·시작메뉴) | PASS |
| 앱 기동 (콘솔 세션) | PASS |
| 사일런트 자동업데이트 e2e (가짜 0.2.3 매니페스트, 루프백 서버) | PASS — 다운로드·해시검증·사일런트 설치 프로세스·앱 재실행(PID 교체) 실관측 |
| 설치기 크기 | 96MB → 16.5MB |

참고: SSH 세션에서는 GUI 재실행이 안 돼(RunAsUser가 데스크톱 세션 필요) 콘솔 세션 스케줄드 태스크로 검증 — 실플릿에서는 사용자 데스크톱 세션에서 설치되므로 해당 없음.

## 산출물
- 윈도우: `~/Projects/maxalert/dist/v0.2.2/MaxAlert-Setup-0.2.2.exe` (sha256 af6528c1…) + latest.yml + SHA256SUMS
- 맥: `~/Projects/maxalert/dist/v0.2.2/MaxAlert_0.2.2_aarch64.dmg` (sha256 8273b185…) — DMG 꾸밈 AppleScript가 TCC 거부돼 hdiutil 직접 생성(기능 동일, 창 배경 꾸밈만 없음, KB 등재)
- 파트너 안내문 초안: `claudedocs/maxalert-partner-tauri-transition-notice-20260718.html` (복사 버튼 포함, 발송은 릴리스 직전 권장)

## CEO 게이트 (전부 비가역 — 승인 필요)
1. **민수 실기 (AIXLIFE)**: 위젯·대시보드·사이렌 시각 확인 (+ 맥 잔여 실기: P1 hover·P2 미니 조작·사이렌 듀얼)
2. **전환 릴리스 게시**: `maxalert-releases`에 v0.2.2(exe+latest.yml) — 게시 순간 전 플릿(1시간 폴링)이 전환 시작. draft 생성 후 publish 권장
3. **카탈로그 갱신**: exe 0.1.9→0.2.2, dmg 0.2.0→0.2.2, version 0.2.2
4. **파트너 안내문 발송** + master 피처 프리즈 협의
5. (릴리스 후) master 브랜치 처리 협의 — mac/tauri가 단일 소스

## 남은 리스크 (정직 고지)
- 실기기 GUI 검증(위젯 표시·사이렌 발화·트레이)은 아직 사람 눈으로 안 봄 — 민수 실기가 마지막 관문
- 비표준 경로에 설치된 Electron(있다면)은 자동 제거 대상 아님 — oneClick은 경로 고정이라 사실상 없음, 있어도 앱및기능에서 수동 제거 가능
- 전환 릴리스 게시 후 롤백은 "다음 버전 픽스"만 가능(구 Electron 복원 불가) — 자동업데이트 채널이 살아있음을 이번에 실증했으므로 픽스 배포 경로는 확보됨

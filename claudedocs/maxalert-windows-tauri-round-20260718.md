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

## 실기 버그 라운드 (같은 날 저녁 — 민수 보고 2건 → 원인 규명·수정·회귀 완료)
민수 실기 보고: (1) "캐릭터가 안 보인다, 프로필에도" (2) "새 할 일 추가 버튼 무반응".

- **진단 방법**: 실기기(AIXLIFE)를 WebView2 원격 디버깅(CDP)으로 직접 열어 실픽셀·invoke 생존 프로브 — 캐릭터 에셋·렌더는 정상인데 **invoke 파이프라인 전체가 사망**한 상태를 발견, 100% 재현 확보.
- **근본 원인**: Tauri v2 동기 커맨드는 WebView2 IPC 콜백 안에서 메인스레드 인라인 실행 → 그 안에서 창을 만들거나 부수면(할일 완료→**보상 캐릭터 팝업**, 사이렌 완료 버튼, 위젯→대시보드 열기, 보상 닫기) WebView2 재진입 제한으로 메인스레드 데드락. 이후 모든 invoke 무반응 → 프로필·캐릭터 미표시, 추가 버튼 무시로 관측된 것. 민수는 할일 완료(보상 팝업 트리거)를 눌렀던 것이 확인됨(대시보드 완료 기록). 맥(WKWebView)은 재진입 허용이라 미발현.
- **수정**: `defer_main()` — 창 생성/파괴 디스패치 7개 지점을 전부 이벤트 루프 큐 강제 경유로 교체 (커밋 e852bdb). 실사이렌(틱 스레드)·맥 동작 불변, 경합은 기존 generation 가드가 처리.
- **회귀 (실기기, 수정 빌드)**: invoke 프로브 생존 → 진짜 todo 추가(추가 버튼 경로) → 틱 자연 발화 사이렌 1창(sound=1, stage=chick) → **chick.webm 재생 확인(readyState 4, 재생 중, 에러 0) + 실픽셀 스크린샷으로 병아리 경찰 캐릭터 확인** → 발화 중·삭제 후에도 invoke 생존 → 사이렌 정상 종료. 전 항목 PASS.
- KB 등재: `maxalert/webview2-ipc-reentrancy-deadlock.md` (CDP 프로브 진단법 포함).

## 산출물 (수정 빌드 e852bdb 기준으로 갱신)
- 윈도우: `~/Projects/maxalert/dist/v0.2.2/MaxAlert-Setup-0.2.2.exe` (sha256 216f251f…) + latest.yml + SHA256SUMS
- 맥: `~/Projects/maxalert/dist/v0.2.2/MaxAlert_0.2.2_aarch64.dmg` — 동일 커밋(e852bdb) 리빌드, DMG 꾸밈 AppleScript가 TCC 거부돼 hdiutil 직접 생성(기능 동일, 창 배경 꾸밈만 없음, KB 등재)
- 파트너 안내문 초안: `claudedocs/maxalert-partner-tauri-transition-notice-20260718.html` (복사 버튼 포함, 발송은 릴리스 직전 권장)

## 배포 종결 (실기 PASS 후 — 2026-07-18 밤)
- maxalert-releases **v0.2.2 게시 완료** (exe+latest.yml) — 공개 latest.yml 0.2.2 서빙·exe sha256 216f251f 일치. 기존 Electron 플릿은 1시간 폴링으로 순차 자동 전환.
- 카탈로그 **라이브 배포 완료** — version 0.2.2, exe/dmg URL·허용목록 갱신, oracle 서비스 active, 공개 다운로드 sha256 exe 216f251f·dmg c9a52d52 일치.
- 함정 기록: 다운로드 실디렉토리는 `/home/ubuntu/aimax-downloads/` (aimax-reports-api/downloads 아님 — 404 download_file_not_uploaded), gh release는 `env -u GITHUB_TOKEN` 필요.
- 잔여: 파트너 안내문 발송(민수·복사 버튼)+피처 프리즈·master 브랜치 정리 협의, 플릿 전환 관찰, 구버전 다운로드 파일 정리(유예 후).

## (기록용) 배포 전 CEO 게이트였던 항목
1. **민수 실기 (AIXLIFE)**: 위젯·대시보드·사이렌 시각 확인 (+ 맥 잔여 실기: P1 hover·P2 미니 조작·사이렌 듀얼)
2. **전환 릴리스 게시**: `maxalert-releases`에 v0.2.2(exe+latest.yml) — 게시 순간 전 플릿(1시간 폴링)이 전환 시작. draft 생성 후 publish 권장
3. **카탈로그 갱신**: exe 0.1.9→0.2.2, dmg 0.2.0→0.2.2, version 0.2.2
4. **파트너 안내문 발송** + master 피처 프리즈 협의
5. (릴리스 후) master 브랜치 처리 협의 — mac/tauri가 단일 소스

## 남은 리스크 (정직 고지)
- 실기기 GUI 검증(위젯 표시·사이렌 발화·트레이)은 아직 사람 눈으로 안 봄 — 민수 실기가 마지막 관문
- 비표준 경로에 설치된 Electron(있다면)은 자동 제거 대상 아님 — oneClick은 경로 고정이라 사실상 없음, 있어도 앱및기능에서 수동 제거 가능
- 전환 릴리스 게시 후 롤백은 "다음 버전 픽스"만 가능(구 Electron 복원 불가) — 자동업데이트 채널이 살아있음을 이번에 실증했으므로 픽스 배포 경로는 확보됨

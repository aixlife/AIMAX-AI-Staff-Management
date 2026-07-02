# P2 윈도우 신뢰성 작업 브리프 (2026-07-02)

이 문서는 윈도우 머신의 Claude Code가 그대로 읽고 실행하는 작업 지시서다. 모든 보고와 사용자 노출 문구는 한국어로 작성하고, 이모지는 절대 사용하지 않는다.

## 1. 배경

AIMAX는 네이버 블로그 자동화 데스크톱 앱(Python/Tkinter, PyInstaller onedir 빌드)이다. 사용자 80명 중 70명이 윈도우이고, 오류 보고 137건 중 117건이 윈도우에서 나왔다. 오라클 서버 데이터 분석(claudedocs/error-pipeline-analysis-20260702.md)으로 윈도우 오류의 2대 구조 원인을 특정했다:

1. **업데이트 부분 교체 (26건+)**: 현재 업데이트는 Inno Setup 인스톨러(packaging/windows/aimax_installer.iss)가 taskkill로 프로세스를 죽인 뒤 같은 폴더를 덮어쓰는 방식이다. 실사용자 증상:
   - `기존파일을 교체하는동안 오류발생 deletefile 실패 :코드5. 엑세스가 거부되었습니다.`
   - `cannot import name 'measure_visible_char_count' from 'content.ai_text'` (v1.0.3, 24건) — app.py는 새 버전인데 content/ai_text.py는 구버전인 혼합 상태. 부분 교체의 직접 증거.
   - 원인 후보: (a) taskkill 후에도 프로세스/런처가 완전히 안 죽음, (b) Windows Defender 실시간 검사가 파일을 잠금, (c) 사용자가 설치 중 오류를 무시하고 계속 진행.
2. **실행기 워커 미시작/행 (38건)**: 서버가 잡을 할당하고 러너(app.py)가 수신 확인까지 했는데 내부 실행 워커 스레드가 시작되지 않거나(27건), UI 큐가 작업 시작을 처리하지 못함(7건), 도중 멈춤(4건). 하트비트는 살아있어서 서버 좀비 보호에 안 걸리는 사각지대.

## 2. 환경 준비

```
git clone https://github.com/aixlife/AIMAX-AI-Staff-Management.git
cd AIMAX-AI-Staff-Management
setup.bat        # uv sync --frozen 경로가 주경로
python build.py  # PyInstaller onedir 빌드 → dist\AIMAX\
```
- 빌드 산출물: dist\AIMAX\ (onedir) + aimax-agent-launcher.exe (Go 런처, packaging/windows/aimax_agent_launcher.go)
- 인스톨러: iscc packaging\windows\aimax_installer.iss (파일 상단 주석에 호출 예시)
- 주의: build.py는 app.py 내부 심볼 존재를 grep으로 검사하는 빌드 가드가 있다. app.py 구조를 바꾸면 build.py도 같이 수정해야 한다.

## 3. 미션

### 미션 1 — 업데이트 실패 재현과 원인 확정
1. 구버전 설치본(서버 다운로드 카탈로그의 이전 버전 또는 로컬 빌드 v-1) 위에 최신 인스톨러를 실행해 업데이트 실패를 재현한다.
2. 다음 시나리오를 각각 시도하고 결과를 기록한다:
   - AIMAX.exe 실행 중 + 런처 실행 중 상태에서 인스톨러 실행
   - 작업(Selenium 크롬 구동) 진행 중 상태에서 인스톨러 실행
   - Defender 실시간 검사 켠 상태 / 예외 등록 상태 비교
3. 증거 수집: Inno Setup 로그(/LOG= 옵션), 이벤트 뷰어의 Defender 검사 기록, 설치 후 dist 폴더의 파일별 수정시각 불일치 여부.
4. 판정: 코드5 액세스 거부의 주범이 프로세스 잠금인지 Defender인지 확정한다.

### 미션 2 — 업데이트 안정화 구현
아래 3층 방어를 구현한다. 각각 독립 커밋.
1. **인스톨러 강화 (aimax_installer.iss)**: AppMutex 지정, CloseApplications=force, RestartManager 활용, 파일 교체 재시도(RestartReplace), 설치 로그 자동 저장. taskkill 후 프로세스 종료를 폴링 대기(최대 10초)하는 코드 섹션 보강.
2. **빌드 매니페스트 + 시작 시 무결성 자기검사**: build.py가 빌드 시 모듈별 해시 매니페스트(예: aimax_manifest.json — 파일 경로, sha256, 버전)를 onedir에 포함. app.py 시작 시(부트스트랩 초기, Tk 뜨기 전) 매니페스트 대조 — 불일치 발견 시 실행을 중단하고 "업데이트가 완전히 적용되지 않았습니다. 인스톨러를 다시 실행해주세요" 안내 창 + 오류 보고 자동 전송(diagnostics/error_reporter.py 경로 재사용). 검사 실패가 아니라 매니페스트 자체가 없으면(구버전 호환) 통과시킨다. 맥에서도 동작해야 하므로 플랫폼 분기 없이 순수 파일 해시 검사로 구현한다.
3. **임포트 불일치 조기 감지**: 부트스트랩에서 핵심 모듈(content.ai_text, posting.editor, local_agent.runtime)을 try-import하고 ImportError 시 위와 같은 "재설치 안내 + 자동 보고" 경로로 보낸다. 지금은 이 오류가 잡 실행 중에 터져서 사용자가 원인을 알 수 없다.

### 미션 3 — 워커 미시작 재현과 2차 좀비보호
1. 재현 시도: 실행기 기동 직후 잡 수신, 절전/화면잠금 복귀 직후 잡 수신, 크롬 프로필 잠금 상태에서 잡 수신 등. app.py의 원격 잡 수신 경로(약 3010–3562행)와 실행 워커 시작 경로(_run_*/_worker_*, 약 5846행 이후)를 읽고 수신→워커 기동 사이에서 끊길 수 있는 지점을 로그로 계측한다.
2. 구현: 잡을 수신(assigned 확인 응답)한 뒤 N초(기본 30초) 안에 해당 워커 스레드가 살아있지 않으면 — (a) 명확한 실패 보고를 서버에 전송하고, (b) 실행기 프로세스를 자체 재시작한다(런처가 있으므로 os._exit 후 런처 재기동 경로 확인. _handle_stop_agent_command의 종료 패턴 참고).
3. 하트비트 페이로드에 현재 진행 단계(수신됨/워커기동/로그인/작성중/발행중)를 포함하도록 확장한다. 서버측 대응은 맥 쪽에서 이어받으므로, 러너가 단계를 보내기만 하면 된다 (필드명: progress_stage).
4. readiness.naver_account.saved_at (ISO 8601, 로컬 설정에 네이버 자격증명을 저장한 시각) 전송 추가. 서버는 이 값이 마지막 로그인 실패 이후이면 네이버 로그인 가드를 자동 해제한다(M-2). 미전송이면 서버가 null 로 하위호환 처리하므로, 값만 채워 보내면 된다.

### 미션 4 — e2e 스모크
Win10 또는 Win11 실기에서: 신규 설치 → 로그인 → 서버 생성 글쓰기 1건 → 로컬 발행 1건 → 인스톨러로 재설치(업데이트 경로) → 재실행 후 같은 작업 1건. 전 단계 스크린샷/로그 수집.

## 4. 제약

- 서버 코드(oracle/ 이하)는 수정 금지. 서버 대응은 맥 쪽에서 진행 중(P1 가드레일).
- AIMAX.spec의 datas/runtime_hooks가 참조하는 파일(config.yaml, assets/, hooks/macos_tk_fix.py, aimax_compliance.py) 이동 금지.
- 처음_읽어주세요.txt, 업데이트_내역.txt는 build.py가 배포 패키지에 동봉하므로 위치 변경 금지.
- AI 모델명 하드코딩 금지. 시크릿/키 값을 로그나 문서에 노출 금지.
- main에 직접 push 금지. 브랜치 windows/p2-reliability-20260702 에 커밋하고 PR을 연다.

## 5. 완료 기준과 보고

- 완료 기준: 미션 1 원인 판정문, 미션 2 구현 후 "업데이트 실패 재현 시나리오에서 부분 교체가 발생해도 앱이 혼합 상태로 실행되지 않음" 확인, 미션 3 계측 로그 + 자체 재시작 동작 확인, 미션 4 전 단계 PASS.
- 보고서: docs/handoffs/windows/2026-07-XX-p2-windows-results.md 에 작성해 PR에 포함. 형식: 재현 결과 → 원인 판정 → 구현 내역(커밋 해시) → 검증 결과 → 남은 위험.
- 막히면 그 지점까지의 증거를 보고서에 정리하고 PR을 열어라. 부분 완료도 가치가 있다.

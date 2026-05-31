# AIMAX macOS-Windows 교차 검증 프로토콜 (Cross-Platform Verification Protocol)

> **문서 목적**: 본 문서는 AIMAX의 핵심 아키텍처인 **OS Abstraction Bridge(OS 독립 코어 브릿지)**와 **Minimal UI/UX 철학**이 macOS와 Windows 11 양쪽 환경에서 오차 없이 한 몸처럼 작동하는지 정밀하게 상호 검증하기 위한 교차 검증(Cross-Verification) 지침서입니다.
> **검증 대상**: AIMAX 로컬 에이전트 코어 (`app.py`, `aimax_compliance.py`, SQLite 로컬 계층 및 Playwright 구동 모듈)

---

## 1. 교차 검증 환경 구성 (Preparation)

원활한 교차 검증을 위해 Mac 환경과 Windows 환경을 아래와 같이 정비합니다.

```
┌────────────────────────┐                    ┌────────────────────────┐
│  macOS Test Station    │◄──────────────────►│  Windows 11 Station    │
│  (Apple Silicon / Intel│    Syncthing Sync  │  (x86_64 Desktop/Laptop│
└────────────────────────┘                    └────────────────────────┘
```

### [Mac 측 필수 준비]
1. Python 3.10+ 환경 구축.
2. 터미널에서 `ioreg` 도구 정상 호출 확인.
3. macOS Keychain 서비스 접근 권한 확인.

### [Windows 측 필수 준비]
1. Python 3.10+ 환경 구축.
2. PowerShell 관리자 권한 실행 가능 확인.
3. Windows Cryptography Registry 접근 권한 확보.

### [공통 브릿지 설정]
- 양 기기 간의 공유 폴더 `/Shared-Bridge/20_Deploy-To-Windows/20260523-Reliability-Upgrade/`가 Syncthing에 의해 실시간 양방향 동기화되고 있는지 확인합니다.

---

## 2. 4대 핵심 교차 검증 시나리오 (Verification Scenarios)

---

### 1단계: 하드웨어 고유 식별자 검증 (`OSHardwareCompliance`)

네트워크 환경 변화(Wi-Fi 변경, VPN 기동, 어댑터 비활성화 등)에도 에이전트가 오작동하지 않고 라이선스를 영구 유지하도록 돕는 정적 Hardware UUID 추출력을 검증합니다.

```
[네트워크 상태 변경 (Wi-Fi ON/OFF, VPN 기동)] ➡️ [식별자 조회] ➡️ [동일 UUID 반환 여부 확인]
```

#### A. Mac 환경 검증 절차
1. Mac 터미널을 열고 다음 명령어를 실행합니다:
   ```bash
   ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID
   ```
2. 출력되는 UUID 값(예: `3A2C1D54-E8B7-...`)을 기록합니다.
3. Wi-Fi를 끄거나 사설 VPN을 켠 상태에서 동일한 명령어를 재실행하여 UUID가 **100% 동일하게 불변**하는지 교차 검증합니다.

#### B. Windows 환경 검증 절차
1. Windows PowerShell(또는 명령 프롬프트)을 열고 다음 명령어를 실행합니다:
   ```powershell
   Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Cryptography" -Name "MachineGuid"
   ```
2. 출력되는 `MachineGuid` 값을 기록합니다.
3. 동일하게 Wi-Fi를 분리하거나 네트워크 카드를 비활성화한 후 명령어를 재실행하여 식별자가 **100% 동일하게 고정**되어 있는지 교차 검증합니다.

#### 🟩 성공 판정 기준
- macOS와 Windows 양쪽 모두 어떠한 네트워크 변화와 하드웨어 동적 카드 교체 하에서도 **절대로 하드웨어 고유 식별자가 가변하지 않고 고정된 일치 값**을 리턴해야 성공입니다.

---

### 2단계: 자격증명 암호화 저장소 검증 (`OSCredentialsBridge`)

계정 유출 및 해킹을 방지하기 위해 로컬 PC의 안전 저장 영역에 네이버 아이디/비밀번호 및 API 키를 암호화 보관하고 원클릭 복원되는지 검증합니다.

```
[계정 정보 입력] ➡️ [OS 보안 API 호출 (Keychain / DPAPI)] ➡️ [SQLite 암호화 저장] ➡️ [평문 복원 테스트]
```

#### A. Mac 환경 검증 절차
1. 예리(글쓰기) 또는 현주(서이추) 어드민 화면에서 네이버 계정 정보 테스트 입력을 수행합니다.
2. macOS `Security.framework Keychain`에 계정 메타데이터가 정상 저장되는지 키체인 접근(Keychain Access) 유틸리티에서 `Aimax_Naver_Creds` 엔트리를 확인합니다.
3. 로컬 SQLite 데이터베이스의 설정 테이블을 덤프하여 패스워드가 평문이 아닌 **AES-256-GCM 바이너리 암호문**으로 엄격하게 암호화 보관되고 있는지 검증합니다.

#### B. Windows 환경 검증 절차
1. Windows 에이전트 화면에서 동일하게 네이버 계정을 입력합니다.
2. Windows API인 `CryptProtectData` (DPAPI) 함수가 에러 없이 호출되는지 에이전트 내부 예외 로그를 확인합니다.
3. 동일하게 `%APPDATA%/Aimax/` 하위의 SQLite를 확인하여 평문 데이터 방치가 차단되고 완벽한 복호화 키 연동이 가동되는지 확인합니다.

#### 🟩 성공 판정 기준
- 어떠한 경우에도 로컬 디렉토리 내에 `.env`나 `.txt` 형태로 **사용자의 평문 패스워드가 잔존하지 않아야 하며**, SQLite DB 내부에는 완벽히 암호화된 스트링만 존재하고, 작업을 실행할 때만 OS의 보안 브릿지를 통해 평문 복원되어 메모리 상에서 안전하게 Playwright로 전달되어야 성공입니다.

---

### 3단계: Playwright 및 브라우저 드라이버 자동 관리 검증 (`OSAutoDriverResolver`)

사용자가 수동으로 드라이버를 설치하느라 겪는 에러를 0%로 만들고, OS 아키텍처에 맞게 무인 다운로드 및 실시간 구동을 성공하는지 검증합니다.

```
[에이전트 실행 시작] ➡️ [OS 드라이버 유효성 dynamic check] 
     ➡️ [알맞은 드라이버 바이너리 무인 다운로드] ➡️ [브라우저 정상 실행]
```

#### A. Mac 환경 검증 절차
1. 기존의 캐시 폴더(`~/Library/Application Support/Aimax/assets/drivers/`)를 강제 삭제하여 드라이버가 없는 빈 상태로 유도합니다.
2. 예리(포스팅)를 실행하여 `OSAutoDriverResolver`가 Apple Silicon(arm64) 혹은 Intel(x64)용 알맞은 웹 드라이버 바이너리를 자동으로 내려받고 포스팅 브라우저를 headless가 아닌 **headed(눈에 보이는 브라우저)**로 크래시 없이 안정적으로 가동시키는지 검증합니다.

#### B. Windows 환경 검증 절차
1. Windows 캐시 디렉토리(`%APPDATA%/Aimax/assets/drivers/`)를 강제로 비웁니다.
2. 현주(서이추)를 실행하여 윈도우용 Chromium 및 엣지 드라이버가 사용자 개입 없이 Dynamic Fetching되어 윈도우 크롬 자동화 창을 안정적으로 열어젖히는지 검증합니다.

#### 🟩 성공 판정 기준
- macOS와 Windows 양쪽 모두에서 **사용자가 직접 웹 드라이버를 수동 매칭하거나 다운로드받는 단계가 원천 배제**되어야 하며, 실행 버튼 클릭 즉시 OS 및 브라우저 버전을 알아서 판독해 캐싱한 뒤 5초 이내에 브라우저 창을 띄우는 데 성공해야 합니다.

---

### 4단계: 극단적 미니멀 UI 및 HITL 예외 복구력 검증

에러가 났을 때 시스템이 멈추거나 뻗어버리는 대신, 꼭 필요한 수동 복구 동작(HITL)으로 자연스럽게 유입되는 미니멀한 UI 연동을 확인합니다.

```
[인위적 에러 주입 (예: Selector 임의 에러 / CAPTCHA 차단)] ➡️ [에이전트 실행 일시 정지]
     ➡️ [어드민 UI 상에 단 하나의 직관적 해결 버튼 노출] ➡️ [사용자 해결 후 재개 성공]
```

#### A. Mac 환경 검증 절차
1. 네이버 스마트에디터의 CSS 셀렉터를 고의적으로 매칭되지 않는 엉뚱한 값으로 환경 변수에 셋팅하여 예리(포스팅)에 에러를 인위적으로 유발합니다.
2. 예리 에이전트가 Crash(폭파)되지 않고, 어드민 상단에 **"임시 저장 성공. 발행 실패 [수동 승인 및 재시도]"** 배너와 메인 CTA 버튼 딱 하나만 심플하게 나타나는지 확인합니다.
3. 해당 버튼을 눌렀을 때, Vision API가 브라우저 스냅샷을 찍어 좌표를 우회 획득한 뒤 발행 버튼을 우회 클릭하여 포스팅을 정상 완수하는지 검증합니다.

#### B. Windows 환경 검증 절차
1. 현주(서이추) 구동 중 인위적으로 CAPTCHA(보안 문자 차단)가 노출되는 환경을 제공합니다.
2. 윈도우 에이전트가 즉시 백그라운드 프리징 상태로 안전히 대기하며, 윈도우 화면 전면에 캡차 이미지 및 텍스트 필드가 있는 초간결 **보안 문자 해결 창** 딱 하나만 띄우는지 확인합니다.
3. 사용자가 문자를 입력하고 **[해결 완료]** 단일 버튼을 클릭했을 때 현주 에이전트가 끊김 없이 다음 서로이웃 추가 행위로 물 흐르듯 전환되는지 검증합니다.

#### 🟩 성공 판정 기준
- 예외 상황 발생 시 **시스템이 무반응 상태(Silent Crash)로 빠지지 않아야 하며**, 복잡한 내부 stack trace 로그 대신 **해결 행동을 즉시 가이드하는 메인 CTA 버튼 1개**만 화면에 노출되고, 해당 조치 완수 시 이어서 작동해야 성공입니다.

---

## 3. 교차 검증 결과 기록지 (Verification Registry Table)

아래 체크 리스트를 대표님과 개발자가 교차 확인 후 각 검증 결과를 체크합니다.

| 검증 단계 | 핵심 기능 검증 대상 | Mac OS 통과 여부 (Y/N) | Windows 통과 여부 (Y/N) | 상호 교차 확인 서명 |
| :--- | :--- | :---: | :---: | :---: |
| **1단계** | 정적 Hardware UUID 고정 추출 (`OSHardwareCompliance`) | | | |
| **2단계** | 키체인 및 DPAPI 암호화 로컬 보관 (`OSCredentialsBridge`) | | | |
| **3단계** | OS Dynamic 드라이버 무인 매칭 (`OSAutoDriverResolver`) | | | |
| **4단계** | 미니멀 HITL 캡차/셀렉터 자가 복구 UI 연동성 | | | |

---

## 4. 교차 검증 통과 후 조치 사항

모든 시나리오에 대해 **Y (통과)**가 획득된 경우:
1. Windows AI 개발자는 검증 성공의 증거로 로컬 Windows 작업 디렉토리의 `app.py` 패치 바이너리 및 검증 로그를 Syncthing 공유 브릿지 폴더에 안전하게 동기화합니다.
2. Mac 개발자는 이 검증 결과를 어드민 서버(`server.js`)에 정식 반영하여 마스터플랜의 Phase 1을 공식 종료하고 서비스 배포(Production release)에 들어갑니다.

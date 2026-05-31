# AIMAX 오류/불편사항 유지관리 보고서 - 2026-05-17

## 목적

이 문서는 2026-05-17 KST 기준 AIMAX 운영 중 발생한 주요 오류, 사용자 불편사항, 원인, 조치 내역, 반복 가능성, 앞으로의 유지관리 포인트를 한 곳에 정리한 운영 보고서다.

근거는 Oracle 운영 데이터, 오류 보고 인덱스, 작업/명령 로그, n8n 로그, Windows AI 개발자 반환 보고서, 배포 기록, 프로젝트 메모리, 그리고 익명화된 AI Council 의견이다. 고객 이메일/이름/토큰/원문 로그 중 민감정보는 제외했다.

## 한줄 결론

현재 가장 큰 장애 축은 Windows 로컬 실행기와 예리 글쓰기 파이프라인이었다. `v1.0.3`은 실행기 연결/설정창 생명주기 문제를 줄였고, `v1.0.4`는 Windows 빌드 조합 불일치로 생긴 예리 글쓰기 초기화 실패를 해결했다. 다만 AI Council까지 종합하면, 이번 문제는 “버그 몇 개”보다 “Windows 빌드/운영 분기가 canonical source보다 빨리 벌어진 상태”가 본질이다. 앞으로 반복될 가능성이 큰 불편은 업데이트 미적용 사용자, 브라우저/네이버 자동화 변동, 이미지 업로드 실패, 사용자 설정 누락, 카페24 비-AIMAX 주문 유입이다.

## 종합 운영 판단

AI Council은 사용자의 위험 인지 확인 후 익명화된 요약만 전달해 실행했다. 원문 로그, 고객 식별정보, 서버 절대경로, 이메일, 키/토큰은 제외했다. Claude/Gemini 관점까지 합치면 판단은 꽤 선명하다.

- 실패율 자체가 높다. 전체 작업 164건 중 실패 76건은 단일 버그 수준을 넘고, Windows 현장 환경과 빌드 분기 관리가 운영 리스크의 중심이라는 신호다.
- `v1.0.3`, `v1.0.4` 조치는 타당하지만, 패치를 계속 쌓기보다 Windows source delta를 canonical source에 선별 병합하고 빌드 검증을 자동화해야 한다.
- mock smoke만 통과한 상태로는 네이버 실제 발행 안정성을 확신할 수 없다. 다음 큰 신뢰 손상은 “앱은 성공처럼 보였는데 실제 콘텐츠가 안 올라감/이미지가 빠짐”에서 나올 가능성이 크다.
- unsigned Windows 설치파일은 기술 문제가 아니라 사용자 업데이트 전환율과 신뢰의 문제다. 필수 업데이트를 걸어도 설치 과정에서 보안 경고가 크면 구버전 사용자가 오래 남는다.
- 카페24 비대상 주문 노이즈는 당장은 작은 운영 잡음이지만, 누적되면 중요한 장애 알림을 늦게 보게 만드는 알림 피로로 이어진다.

따라서 유지관리 우선순위는 “새 기능 추가”보다 “Windows 빌드 무결성, 실제 E2E 검증, 구버전 전환, 운영 노이즈 제거”에 둬야 한다.

Council 의견까지 반영한 실행 우선순위는 다음 순서다.

1. 이번 주 안에 통제된 실 계정으로 실제 네이버 발행 E2E 1회를 수행한다. paid API가 들어가면 provider/model/action/예상 비용을 먼저 승인받고, 재시도는 request/job id resume-first로 한다.
2. Windows source delta를 canonical Mac source에 선별 병합한다. diagnostics probe, browser recovery marker, content module 동기화, build integrity check는 다음 Windows 빌드 전 필수 검증으로 올린다.
3. Windows 구버전 사용자 전환율을 추적한다. `v1.0.4` 미만 사용자가 일정 기간 남으면 기능 제한 또는 더 강한 업데이트 안내를 검토한다.
4. 코드서명 계획을 잡는다. 당장은 unsigned 경고 안내를 보강하고, 장기적으로 서명된 설치파일을 목표로 한다.
5. 카페24 비대상 상품 필터를 n8n 또는 API 레벨에 추가한다.

## 운영 현황 스냅샷

2026-05-17 13:05 KST 전후 운영 데이터 기준:

- 오류 보고: 20건
- 오류 보고 상태: 완료 10건, 사용자 확인 필요 3건, 신규 7건
- 작업: 164건
- 작업 상태: 완료 86건, 실패 76건, 실행 중 2건
- 작업 종류: 예리 글쓰기 96건, 현주 고객 찾기 68건
- Agent 명령: 350건, 전부 `open_settings`
- Agent 명령 상태: 완료 57건, 실패 291건, delivered 2건
- Windows Agent 등록: 28대
- Windows Agent 버전: `v1.0.2` 27대, `v1.0.3` 1대, `v1.0.4`는 배포 직후라 아직 운영 heartbeat에는 미집계
- 카페24 주문 대기열: 3건, 모두 `unknown_product` / `needs_review`

## 주요 오류 분류

| 분류 | 증상 | 확인된 규모 | 조치 상태 |
|---|---|---:|---|
| Windows 설정창/Tk 생명주기 | 로컬 설정 열기 실패, `application has been destroyed`, `tk.tcl` 문제 | `open_settings` 350건 중 실패 291건 | `v1.0.3` Windows 필수 업데이트 배포 |
| Windows 실행기 연결/보이지 않음 | 실행기 클릭 후 반응 없음, 작업관리자에는 실행 중, 앱 창 안 보임 | 사용자 보고 다수, 2026-05-14 집중 | `v1.0.3` native Go launcher guard 배포 |
| 예리 글쓰기 초기화 import 실패 | `measure_visible_char_count` import 실패 | 2026-05-16 이후 실패 29건 중 26건 | `v1.0.4` Windows 필수 업데이트 배포 |
| 브라우저 세션 detach/창 종료 | `target frame detached`, 네이버 로그인 후 창 꺼짐 | 오류 보고 2건, 작업 실패 일부 | `v1.0.4`에 복구 로직 포함, 운영 관찰 필요 |
| 이미지 첨부 실패 | 이미지 3장 요청했지만 0장 첨부 | 오류 보고 2건, 작업 실패 일부 | `v1.0.4`에서 명확한 실패 단계 보고, 실제 원인은 지속 관찰 |
| 글 생성 실패 | 여러 키워드 `content_generation` 실패 | 작업 실패 18건 수준 | 원인 분리 필요: API/프롬프트/키워드/요금제 |
| 사용자 설정 누락/혼동 | 네이버 계정, API 키, 서로이웃 멘트 누락 | 오류 보고 3건 이상 | UX/안내 일부 개선, 계속 발생 가능 |
| 대기/진행상태 혼란 | “대기중 상태에서 작업이 안 됨” | 오류 보고 1건, 잠재 반복 가능 | `v1.0.4` smoke는 통과, 운영 모니터 필요 |
| 카페24 주문 대기열 노이즈 | AIMAX 외 상품이 주문 대기열로 들어옴 | 3건 | n8n/API 상품 필터 보강 필요 |
| n8n IMAP transient | `This socket has been ended... Will try to reactivate` | 최근 1건 확인 | 장애로 보이진 않지만 모니터 필요 |

## 타임라인

### 2026-05-07: v1.0.2 사용자 피드백 핫픽스

조치:

- 대시보드 readiness refresh 개선
- 실패 키워드/단계 보고 개선
- Smart Editor bold 자동화 기본 비활성화
- 브라우저 세션 복구 초기 대응
- 중복 Local Agent 실행 guard
- 예리 명칭을 “블로그 글쓰기”로 보정

의미:

이 시점부터 단순 크래시보다 “어느 단계/키워드에서 실패했는지”가 더 잘 드러나기 시작했다. 이후 보고 품질은 올라갔지만, Windows 로컬 실행기 생명주기 문제는 남아 있었다.

### 2026-05-08: 온보딩 비밀번호/설정 링크 전환

문제:

- 임시 비밀번호를 이메일로 보내는 방식은 보안/운영상 위험이 컸다.
- Gmail connector로 live setup link 자동 발송은 credential-equivalent로 차단됐다.

조치:

- `/setup`, setup-token, setup-password 흐름 추가
- 기존 임시 비밀번호는 폐기 방향
- 즉시 발송은 수동 mail merge 또는 별도 transactional mailer로 보류

반복 가능성:

신규 구매자 온보딩에서 “메일이 안 왔다”, “비밀번호가 뭔지 모르겠다” 류의 문의가 계속 나올 수 있다. 안정적인 transactional mailer가 필요하다.

### 2026-05-13: 오류 보고 운영화

문제:

- 사용자가 오류를 보내도 운영자가 바로 묶어 보기 어려웠다.
- 사용자 입장에서는 접수 여부와 처리 상태가 불투명했다.

조치:

- 관리자 콘솔 오류 보고 탭/상세/수정 요청서 복사 UX 정리
- Telegram 알림 연동
- 오류 보고 후 접수 ID와 안내 카드 표시
- 상태값: 접수됨, 확인 중, 조치 중, 사용자 확인 필요, 완료

반복 가능성:

오류 자체는 계속 생기므로, 오류 보고 UX는 “장애를 없애는 기능”이 아니라 “지원 비용을 낮추는 기능”이다. 앞으로 실패 작업의 진단 첨부 자동화가 핵심이다.

### 2026-05-14~15: Windows 실행기 연결/설정창 문제

증상:

- `실행기 연결`을 눌러도 눈에 보이는 반응이 없음
- 로컬 설정 열기가 안 열림
- 작업관리자에는 떠 있는데 앱 창이 없음
- 일부 경로에서 `tk.tcl` 사용 불가
- `open_settings` 명령이 대량 실패

확인:

- `open_settings` 명령 350건 중 실패 291건
- 대부분 Windows Local Agent의 Tk 생명주기 오류로 분류

원인:

- 장기 실행 중인 headless Local Agent에서 Tk root 생성/파괴를 반복하는 구조가 Windows에서 취약했다.
- 실행기 프로토콜과 단일 인스턴스 guard가 PyInstaller/Tk 런타임 뒤에 있어, 이미 깨진 런타임 상태에서 사용자가 여러 번 누르면 증상이 더 커졌다.

조치:

- Windows `v1.0.3` 배포
- native Go launcher guard를 PyInstaller/Tk 앞단에 배치
- `aimax://agent/connect` 반복 클릭 시 단일 launcher/core 프로세스 유지
- local settings dialog 반복 열기/저장/닫기 smoke 통과

남은 리스크:

- 아직 운영 Agent 28대 중 27대가 `v1.0.2`로 집계된다. 사용자가 업데이트를 적용하기 전까지 같은 증상이 반복될 수 있다.
- EXE가 unsigned라 Windows 보안 경고/차단으로 실행 불편이 생길 수 있다.

### 2026-05-16~17: 예리 글쓰기 초기화 import 실패

증상:

```text
cannot import name 'measure_visible_char_count' from 'content.ai_text'
```

영향:

- 2026-05-16 이후 작업 64건 중 실패 29건
- 실패 29건 중 26건이 `init` 단계에서 동일 import 오류
- 모두 `yeri_write`

원인:

- Mac 기준 소스에는 `content/ai_text.py`에 `measure_visible_char_count` 함수가 있었다.
- 이전 Windows handoff/source bundle에는 `content/ai_text.py`가 빠져 있었다.
- Windows 빌드 트리에서 새 `split_version/app.py`와 오래된 `content.ai_text`가 섞였다.
- 결과적으로 설치본 `_internal/content/ai_text.py`에는 함수가 없는데 앱은 이를 import했다.

조치:

- Windows AI가 `content/ai_text.py`, prompts, SEO brief를 root와 split tree에 동기화
- 설치본 diagnostics probe에 import smoke 추가
- Windows `v1.0.4` 재빌드
- Oracle에 Windows `v1.0.4` 필수 업데이트 배포
- `v1.0.3` 이하: `update_required=true`
- `v1.0.4`: 최신으로 인식

반복 방지 포인트:

- Windows source handoff ZIP에 import되는 모든 모듈이 포함되어야 한다.
- Windows 빌드 전 반드시 installed/onedir diagnostics probe를 실행해야 한다.
- source delta를 Mac canonical source에 선별 병합하지 않으면 다음 빌드에서 같은 drift가 다시 생길 수 있다.

### 2026-05-16: 브라우저/네이버 자동화 불안정

증상:

- `target frame detached`
- `no such window` 유사 상황
- 네이버 로그인 후 창이 꺼짐

원인 추정:

- Chrome/Whale 버전 변화, 네이버 로그인/에디터 페이지 구조 변경, Selenium/undetected_chromedriver 세션 detach
- 사용자가 로그인 창을 닫거나 브라우저가 자동 종료되는 경우

조치:

- Windows `v1.0.4`에 target frame detached/no such window 복구 마커 추가
- 초기 로그인/브라우저 startup을 1회 재시도
- mocked smoke 통과

남은 리스크:

- 실제 네이버/Chrome/Whale 환경은 계속 변한다.
- mock smoke는 실제 네이버 발행을 대체하지 못한다.
- 실사용 로그에서 동일 오류가 다시 찍히는지 24~72시간 관찰해야 한다.

### 2026-05-16: 이미지 0장 첨부

증상:

- 이미지 3장을 요청했지만 0장 첨부
- 임시저장 발행 후 이미지 누락

가능 원인:

- 이미지 생성 API 실패 또는 quota
- 생성 파일 다운로드/저장 실패
- Smart Editor 업로드 selector 변경
- 네이버 에디터가 업로드를 거부
- paid image generation 후 실패했는데 재시도/복구 정보가 부족한 경우

조치:

- Windows `v1.0.4`에서 이미지 요청/생성/삽입 수를 명확히 기록
- 3/0/0 상황은 `smart_editor_input`에서 깨끗하게 실패하도록 개선

남은 리스크:

- 이미지 생성 자체가 paid flow일 수 있어 무분별한 재시도는 비용 리스크가 있다.
- 사용자는 “글은 됐는데 이미지가 없다”를 품질 문제로 크게 체감한다.
- 실패 시 생성된 로컬 파일 경로, 업로드 단계, provider request id를 안전하게 보고하는 흐름이 더 필요하다.

### 2026-05-16: 카페24 주문 대기열

증상:

- 카페24 주문 자동 수집은 동작하지만, AIMAX 계정 상품이 아닌 상품도 `needs_review`로 들어옴
- 현재 3건 모두 `unknown_product`

현재 들어온 상품명:

- `[5월 오프라인/회원전용] AI로 직원 만드는법`
- `[구독제] 일본구매대행 사이트`
- `[5월 오프라인] AI로 직원 만드는 법`

원인:

- n8n 또는 AIMAX API가 “카페24 주문 메일” 전체를 받아 AIMAX 상품 여부를 충분히 필터링하지 않는다.

조치 상태:

- 계정 자동 생성은 관리자 확인 후 선택 실행이라 위험은 낮다.
- 다만 운영자가 매번 noise를 확인해야 한다.

필요 조치:

- n8n에서 AIMAX 계정 상품명만 AIMAX API로 전송
- 또는 API에서 비-AIMAX 상품은 `ignored`로 자동 분류
- 관리자 화면에 `ignore` 일괄 처리 버튼 또는 필터 추가

## 반복적으로 생긴 오류 패턴

### 1. Windows 패키징/소스 동기화 drift

가장 위험한 반복 패턴이다.

이번 `measure_visible_char_count` 오류는 코드 기능 자체의 버그가 아니라 “빌드에 들어간 파일 조합이 서로 다른 버전”이라 생겼다. Windows 개발자가 일부 파일만 받아 빌드하거나, split tree와 root tree가 다르게 유지되면 다시 생긴다.

방지책:

- Windows handoff source ZIP은 전체 import dependency를 포함
- split tree와 root tree 자동 동기화 체크
- 빌드 산출물에서 `--diagnostics-probe` 실행
- `from content.ai_text import ...` 같은 핵심 imports를 설치본 기준으로 검사
- Windows source delta를 Mac canonical source에 선별 병합하는 절차 마련

### 2. Windows 로컬 실행기 lifecycle

사용자 불편이 가장 컸던 영역이다. `실행기 연결`, `로컬 설정 열기`, “창이 안 보임”은 모두 사용자가 제품이 멈췄다고 느끼는 증상이다.

`v1.0.3`으로 구조적 조치는 했지만, 아직 많은 사용자가 `v1.0.2`로 남아 있어 반복 문의가 나올 수 있다.

방지책:

- 업데이트 강제 안내
- 구버전 heartbeat 사용자에게 관리자 알림
- `v1.0.2` 사용자가 오류 보고 시 “최신 실행기 설치 후 재시도” 안내 자동화
- signed installer 확보

### 3. 브라우저/네이버 자동화 변동

네이버, Chrome, Whale은 외부 시스템이라 계속 변한다. `target frame detached`, `no such window`, 로그인 창 종료, Smart Editor selector 변화는 장기적으로 반복될 수밖에 없다.

방지책:

- browser-session error taxonomy 유지
- 자동 1회 재시도와 session reset
- 실패 단계/키워드/브라우저 버전 기록
- Windows/Chrome/Whale 별 smoke matrix

### 4. 이미지 생성/업로드

이미지는 paid API와 네이버 업로드 UI가 모두 걸려 있어 실패면 원인 분리가 어렵다. 사용자 만족도에 미치는 영향도 크다.

방지책:

- generated / downloaded / inserted count 분리
- provider request id/status id 저장
- paid 재시도 금지 및 resume-first 정책
- 이미지 실패 시 글만 저장할지 전체 실패할지 정책 명확화

### 5. 사용자 설정 누락

네이버 계정, API 키, 서로이웃 멘트, 실행기 연결 상태는 계속 사용자 문의를 만든다.

방지책:

- 작업 생성 버튼 앞에서 readiness blocker를 더 강하게 표시
- “로컬 보안 설정”과 “웹 작업 설정”의 차이를 명확히 안내
- Hyunju 서로이웃 멘트처럼 local settings에 없는 항목은 UI 용어를 분리

## 앞으로 사용자 불편이 계속 나올 지점

### 업데이트 미적용 사용자

Windows Agent 28대 중 운영 집계상 대부분이 아직 `v1.0.2`다. `v1.0.4` 배포 직후라 자연스러운 상태지만, 당분간 구버전 사용자의 동일 오류 보고가 계속 들어올 가능성이 높다.

예상 문의:

- 실행기 연결이 안 된다
- 설정 창이 안 열린다
- 글쓰기가 대기 중에서 멈춘다
- 같은 오류가 또 난다

운영 대응:

- 먼저 Agent 버전 확인
- `v1.0.4` 미만이면 업데이트 안내
- 업데이트 후에도 재현되는 건만 개발 이슈로 분리

### Windows 보안 경고

Windows 반환 보고서에 따르면 설치파일은 unsigned다. Smart App Control, WDAC, 백신, 기업 보안 정책에서 경고/차단 가능성이 있다.

예상 문의:

- 설치가 막힌다
- 위험한 앱이라고 뜬다
- 실행하려면 추가 확인이 필요하다

운영 대응:

- 코드서명 인증서 확보 전까지 안내문 필요
- 다운로드 페이지에 “Windows 보안 경고 시 추가 정보 -> 실행” 안내 여부 검토

### 실제 네이버 발행 미검증

Windows `v1.0.4`는 paid generation과 실제 네이버 posting을 하지 않았다. mock/no-cost smoke는 통과했지만, 실제 고객 환경에서는 네이버 로그인, 에디터, 이미지 업로드, 예약발행에서 다시 실패할 수 있다.

운영 대응:

- 첫 24~72시간 `yeri_write` 실패율 집중 관찰
- `smart_editor_input`, `smart_editor_publish`, `naver_login`, `content_generation` stage별로 분리

### 카페24 주문 노이즈

AIMAX가 아닌 상품 주문이 관리자 대기열에 계속 쌓이면 운영자가 놓치거나 피로해진다.

운영 대응:

- AIMAX 대상 상품명 allowlist 구성
- 비대상 상품은 자동 ignored 또는 별도 “참고 주문”으로 분리

## 유지관리 체크리스트

### 매일 확인

- 신규 오류 보고 `new` 수와 분류
- `waiting_user` 중 오래된 보고
- 최근 24시간 job 실패율
- `yeri_write` 실패 stage 분포
- `open_settings` 실패 증가 여부
- Windows Agent 버전 분포
- 카페24 `unknown_product` 대기열 수

### Windows 빌드 전 필수

- root/split source 동기화 확인
- `content.ai_text` import smoke
- installed/onedir `--diagnostics-probe`
- `aimax://agent/connect` 5회 이상 반복
- local settings 열기/저장/닫기 10회 이상 반복
- Chrome/Whale session detach mock
- 이미지 requested/downloaded/inserted count smoke
- non-ASCII 설치 경로 테스트
- SHA256 기록

### Oracle 배포 전 필수

- 이전 설치파일 remote backup
- 새 설치파일 SHA와 Windows 반환 SHA 대조
- `/api/version?platform=windows&current=<old>` required update 확인
- `/api/version?platform=windows&current=<new>` 최신 확인
- macOS 버전 영향 없음 확인
- service restart 후 `/health` 확인
- 배포 문서 작성

### 오류 보고 운영

- 완료 처리 전에 사용자가 볼 안내문 작성
- `waiting_user`는 사용자 행동이 필요한 경우에만 사용
- 반복 유형은 수정 요청서로 묶어 Windows/Mac 담당을 분리
- paid API 관련 오류는 request/job id 보존 후 재시도 금지

## Mac/Windows 협업 순서

이번 안정화는 Mac/Oracle 쪽에서 기준선과 소스 병합을 먼저 잡고, Windows 쪽에는 “빌드하거나 실제 Windows 환경에서만 검증할 수 있는 시점”에 넘기는 순서가 맞다.

### 1단계: Mac/Oracle 기준선 확인

담당:

- Mac/Oracle

할 일:

- `v1.0.4` 이후 24~72시간 실패율 확인
- `measure_visible_char_count` 오류가 최신 Agent에서 재발하는지 확인
- Windows Agent heartbeat 버전 분포 확인
- 구버전에서만 나는 오류와 최신 버전에서도 나는 오류를 분리

Windows 전달 여부:

- 정상 흐름에서는 아직 전달하지 않는다.
- 단, `v1.0.4` Agent에서 같은 import 오류가 나오면 즉시 Windows 긴급 재검증으로 넘긴다.

Windows에 넘길 조건:

- 최신 Agent version, 실패 job id, 실패 stage, 다운로드 SHA, 사용자가 받은 EXE 이름이 확인된 경우

### 2단계: Mac에서 Windows source delta 선별 병합

담당:

- Mac/canonical source

할 일:

- Windows 반환 ZIP의 변경사항을 canonical source와 비교
- `content.ai_text`, diagnostics probe, browser recovery, image count reporting, launcher packaging 관련 변경만 선별
- Mac 빌드에 영향이 큰 파일은 통째 덮지 않고 필요한 조각만 반영
- import smoke와 Mac 기본 smoke 수행

Windows 전달 여부:

- 이 단계가 끝나기 전에는 Windows에 새 빌드를 요청하지 않는다.
- 병합 전 소스로 다시 빌드하면 같은 drift를 반복할 가능성이 높다.

Windows에 넘길 조건:

- canonical source 병합 패치가 확정됨
- Mac smoke/import smoke가 통과함
- Windows 후보 빌드용 source ZIP 또는 patch가 준비됨

### 3단계: Windows 후보 빌드 요청

담당:

- Windows AI developer

Mac에서 넘길 것:

- Syncthing handoff 문서
- Windows AI copy-paste prompt
- sanitized source ZIP 또는 명시 patch
- 필수 검증 목록과 반환 형식

Windows에서 할 일:

- Syncthing 밖의 로컬 작업 폴더로 소스 복사
- Windows EXE 3종 빌드
- installed/onedir `--diagnostics-probe`
- `content.ai_text.measure_visible_char_count` import 확인
- `aimax://agent/connect` 5회 반복
- 설정창 열기/저장/닫기 10회 반복
- Chrome/Whale detach mock
- 이미지 0장/3장 count smoke
- 비ASCII 설치 경로 테스트
- SHA256 기록

Mac에서 받을 것:

- completion/blocker report
- EXE 3종
- source delta ZIP
- SHA256SUMS

통과 기준:

- 설치본 내부에서 import mismatch가 없어야 함
- 설정창과 protocol connect 반복 테스트가 실패 없이 지나야 함
- 이미지 count가 requested/downloaded/inserted로 분리 보고되어야 함

### 4단계: Mac/Oracle 배포 검증

담당:

- Mac/Oracle

할 일:

- Windows 반환 SHA와 업로드 파일 SHA 대조
- 기존 원격 설치파일 백업
- Oracle 다운로드 경로에 새 파일 업로드
- `/api/version`에서 old version은 required update, new version은 최신으로 응답하는지 확인
- macOS 버전 영향 없음 확인
- 배포 문서 작성

Windows 전달 여부:

- 배포 후에는 Windows에 “다운로드/업데이트 경로 검증”만 짧게 넘긴다.
- 이때는 새 빌드 요청이 아니라 사용자가 받는 경로가 맞는지 확인하는 단계다.

Windows에 넘길 조건:

- Oracle 배포 완료
- version API 검증 완료
- 새 다운로드 URL 또는 앱 업데이트 흐름이 준비됨

### 5단계: 실제 네이버 발행 E2E

담당:

- Mac/Oracle이 작업을 만들고 관찰
- Windows가 실제 로컬 자동화 실행 환경을 제공

시작 조건:

- Windows 후보 빌드 통과
- Oracle 배포 또는 테스트 다운로드 경로 통과
- 통제된 네이버 계정 준비
- paid API가 들어가면 provider/model/action/예상 비용 승인 완료

Windows에서 할 일:

- 최신 설치본으로 로그인/설정 완료
- 예리 글쓰기 1회 실행
- 제목, 본문, 이미지, 발행/예약 상태 확인
- 실패 시 stage, 화면 상태, sanitized 로그, job id 반환

Mac에서 할 일:

- job 생성과 서버 로그 관찰
- request/job id 보존
- 실패 시 중복 paid submit 금지
- 결과를 오류 보고/운영 보고서에 반영

통과 기준:

- 네이버 실제 화면에서 글 본문/제목/이미지/발행 상태가 확인되어야 함

### 6단계: 서버/UX 개선

담당:

- Mac/Oracle 우선

할 일:

- 오류 보고에 failed stage, keyword, Agent version, job id 자동 첨부
- 로그인/대시보드 진입 시 사용자 환경에 맞는 공지/업데이트 안내 표시
- 카페24 AIMAX 상품 allowlist 적용
- `unknown_product` 자동 ignored 또는 별도 큐 분리
- 사용자에게 업데이트 필요/설정 누락/대기 중 상태를 더 명확히 표시

공지/업데이트 안내 기준:

- 사용자 OS가 Windows인지 macOS인지 구분한다.
- 현재 Local Agent version과 서버의 latest/minimum version을 비교한다.
- 필수 업데이트(`update_required`)는 로그인 직후 모달과 대시보드 상단 고정 배너로 반복 안내한다.
- 권장 업데이트(`update_available`)는 1회 모달 또는 상단 배너로 안내하고, 버전별 “다시 보지 않기”를 허용한다.
- 최신 사용자에게는 업데이트 완료/개선 사항 안내를 1회성으로 보여준다.
- 일반 공지는 기간/대상 OS/대상 버전에 맞춰 표시하고, 작업을 방해하지 않는 배너 또는 공지함 형태를 우선한다.
- Windows 전용 장애/업데이트는 Windows 사용자에게만 보여준다. macOS 정상 사용자에게 Windows 공지를 띄우지 않는다.

Windows 전달 여부:

- 서버/UI만 바뀌면 Windows 전달 없음
- Agent 표시나 로컬 진단 포맷이 바뀌면 다시 3단계 후보 빌드 요청으로 돌아간다.

### 7단계: 코드서명/장기 배포

담당:

- Windows 설치/배포 정책 중심
- Mac/Oracle은 다운로드/버전 API와 문서 지원

할 일:

- 코드서명 인증서 확보 가능성 판단
- unsigned 경고 안내 보강
- 장기적으로 통합 설치파일과 entitlement 기반 직원 접근 전략 검토

Windows 전달 여부:

- 코드서명 방식이 정해질 때 Windows에 설치파일 서명/검증 요청
- 다운로드 URL, SHA, version API는 Mac/Oracle에서 다시 검증

## 권장 후속 작업

### P0: v1.0.4 이후 72시간 모니터링

목표:

- `measure_visible_char_count` 오류가 사라지는지 확인
- 구버전 사용자에서만 발생하는지 확인
- `v1.0.4` Agent heartbeat가 운영 데이터에 들어오는지 확인

판정:

- `v1.0.4`에서 동일 import 오류가 나오면 배포/설치 캐시/다운로드 mismatch를 즉시 조사
- 구버전에서만 나오면 사용자 업데이트 안내로 처리

### P1: Windows source delta 선별 병합

목표:

- Windows가 고친 내용 중 canonical Mac 소스에 필요한 것을 반영
- 특히 `AiGenerationError`, `AiQuotaError`, diagnostics probe, browser recovery, launcher packaging 파일 검토

주의:

- `build.py`는 Mac DMG 배포 흐름에 영향이 있어 통째 덮어쓰기 금지
- 필요한 조각만 선별 반영

### P1: 실패 작업 자동 진단 첨부

목표:

- 사용자가 오류 보고할 때 최근 failed jobs, failed stage, keyword, sanitized result, Agent version을 자동 첨부
- 현재 사용자 보고에는 web context만 있고 agent/job context가 빈 경우가 많다

효과:

- “키워드 미확인” 같은 막연한 보고 감소
- 운영자가 Oracle 데이터를 따로 뒤지지 않아도 됨

### P1: 환경 맞춤 공지/업데이트 안내

목표:

- 사용자의 OS, 현재 Agent version, 서버 version policy, 공지 대상 조건에 따라 다른 안내를 표시
- Windows 필수 업데이트 사용자는 작업 실패 가능성을 명확히 알리고 업데이트 링크로 유도
- 최신 버전 사용자는 “무엇이 개선되었는지”를 짧게 안내

표시 규칙:

- `update_required`: 로그인 직후 모달 + 대시보드 상단 고정 배너
- `update_available`: 1회 모달 또는 상단 배너, 버전별 다시 보지 않기 가능
- 최신 버전 개선 안내: 1회성 확인 모달
- 일반 공지: OS/버전/기간 조건을 가진 배너 또는 공지함

주의:

- Windows 전용 공지를 macOS 사용자에게 보여주지 않기
- “업데이트하세요”보다 “이전 버전에서 어떤 문제가 있었고 최신 버전에서 무엇이 안정화됐는지”를 설명하기
- 필수 업데이트 전에는 글쓰기/고객찾기 실패 가능성을 분명히 고지하기

### P1: 카페24 상품 필터

목표:

- AIMAX 계정 상품만 대기열에 넣기
- 비대상 주문은 n8n 또는 API에서 자동 ignored 처리

### P2: 코드서명

목표:

- Windows 설치/실행 보안 경고 감소
- enterprise security 환경 대응

### P2: 통합 설치파일 전략

목표:

- 장기적으로 OS별 통합 설치파일 하나로 줄이기
- 계정 entitlement로 직원 접근 제어
- Windows/Mac 재빌드/배포 부담 감소

## 최종 판단

이번 장애들의 공통 뿌리는 “로컬 실행기라는 불안정한 현장 환경”과 “Mac/Windows 빌드 소스의 drift”다. 서버 API 자체는 비교적 안정적으로 동작했고, 오히려 운영 데이터가 충분히 쌓이면서 원인을 좁힐 수 있었다.

앞으로의 유지관리 핵심은 다음 세 가지다.

1. Windows 빌드/설치본 검증을 자동화한다.
2. 실패 작업의 진단 정보를 오류 보고에 자동 첨부한다.
3. 사용자가 “대기 중인지, 업데이트가 필요한지, 설정이 빠졌는지”를 화면에서 즉시 알 수 있게 한다.

이 세 가지를 잡으면, 같은 오류가 다시 생기더라도 고객 불편과 운영 추적 비용이 크게 줄어든다.

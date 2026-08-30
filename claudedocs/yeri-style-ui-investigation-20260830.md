# 예리 글쓰기 스타일 설정 탭 경위 + 웹앱 UI 구조 조사 (읽기 전용)

조사 대상: oracle/aimax-reports-api/static/app.html (15,219줄), oracle/aimax-reports-api/server.js (19,852줄)
기준 커밋: 69bfe5b (2026-08-25 16:05, "예리 글쓰기 스타일 3종 — 계정에 한 번 고르면 계속 적용")

## (a) 경위 — 커밋 69bfe5b 근거

- 스타일 3종은 서버 상수 `YERI_STYLE_PACKS` (consult 상담 유도형 / info 정보 정리형 / review 후기·추천형)로 정의. 각 스타일은 5줄 지시문을 가진다. 현재 코드 server.js:2062~2096 부근.
- 프롬프트 주입: `buildYeriGenerationPrompt` 에서 `글 스타일: <라벨>` 한 줄 + 스타일팩 5줄이 지시문에 들어간다 (diff 기준 server.js:2683~2687).
- 구버전 값 호환: `YERI_STYLE_ALIASES` — buy/ad/sell→consult, info→info, 빈 값·모르는 값→info (server.js:2097~2103).
- 계정 단위 저장: `GET/POST /api/user/writing-style` (핸들러 server.js:4147~4183 부근, 라우팅 server.js:19167~19174). 값은 users 파일의 `user.yeri_style` 필드에 저장, `publicUser` 에도 노출.
- 잡 생성 폴백: `handleCreateJob` (server.js:18073) — kind 가 `yeri_write` 이고 payload 에 유효한 style_id/style 이 없을 때만 계정 저장값을 `jobPayload.style_id` 로 채운다 (server.js:18087~18090).
- 설정 탭 UI: "글쓰기 스타일" 패널 (app.html:4408~4415) + 카드 렌더 JS (app.html:12240~12335 부근). 카드 클릭 즉시 POST 저장.
- '글마다 고르지 않기'로 간 근거(커밋 메시지 원문): 기존 옵션 실사용률이 카테고리 44% → CTA 42% → SEO 26% → 문체참고 8% 로 손이 갈수록 하락, "매번 고르라고 하면 대부분 기본값으로 간다".
- 단, 같은 커밋 메시지가 자인하는 사실: "그전에는 스타일을 고를 화면이 아예 없어서 서버에만 있고 아무도 쓸 수 없었다(688건 중 675건이 기본값이었던 진짜 이유)". 즉 '675/688 기본값' 데이터는 선택 UI 부재 상태에서 수집된 것이다. 실사용률 하락 수치도 잡 생성 폼 안의 다른 옵션들 이야기이지, 스타일 선택을 글마다 시켰을 때의 데이터가 아니다.

## (b) UI 인벤토리 (탭 → 섹션 → 핵심 컨트롤, app.html 줄번호)

최상위: `#loginView` 로그인 (3486~), `#appView` 앱 셸 (3511~). 사이드 nav 버튼 6개 (3523~3529): overview(대시보드)/staff(직원 채용)/jobs(직원 업무지시)/feedback(직원 피드백)/settings(설정)/updates(업데이트 및 오류보고).
탭 패널은 7개: `#overviewTab` 3604, `#staffTab` 3653, `#researchTab` 3701, `#jobsTab` 3837, `#settingsTab` 4380, `#updatesTab` 4552, `#feedbackTab` 4681. 전환은 nav 클릭 핸들러 (15189~15194)가 전 패널 hidden 후 `#{tab}Tab` 만 표시.

공통(모든 탭 위): topbar 제목/새로고침 3538~3546, 알림 배너 4종 — passwordNotice 3548, globalUpdateNotice 3552, pendingReportsNotice 3564, jobGuardNotice 3575, 비밀번호 변경 패널 3585.

- overview: AIMAX 스튜디오 소개 3605, "다음 행동" 3641.
- staff: 직원 채용 현황 3654 (+ 직원 이력서 오버레이 staff-resume 4770~4823, 기본정보/기술 등 섹션 9개).
- research (고아 — 아래 (d)-1): 송이 자료조사 3702, 자료 추가 3738.
- jobs: 직원 업무지시 패널 3838 — 직원 선택 스위치 `#jobEmployeeSwitch` 3844, 직원별 폼 6개가 hidden 토글로 공존: yeriJobForm 3846 / hyunjuJobForm 3946 / yunmiJobForm 3998 / sangsuJobForm 4020 / songiJobForm 4104 / taxJobForm 4255 (jobFormConfigs 5744~5781). 일 맡긴 기록 테이블 4371~4376.
- settings: 로컬 설정 4381, 실행기 4388, **글쓰기 스타일 4408**, 웹 작업 설정 4416, AI/API 연결 4443, API 키 발급 가이드 4516.
- updates: 업데이트 및 오류보고 4553, 설치 파일 4578, 배포 기준 4601, 내 권한의 설치 파일 4621, 오류 보고 4628, 수집 상태 4652, 내 문의/피드백 4672.
- feedback: 직원 피드백 4682, 전달 기준 4733.

### 예리 잡 생성 폼의 현재 옵션 (순서 그대로, app.html 3853~3944)
1. 키워드 (필수) 3856~3857
2. 발행 방식 select: 즉시 발행/임시 저장/예약 발행 3860~3866
3. 글쓰기 모델 select 3868~3870
4. 이미지 모델 select 3872~3874
5. 분량 select 300/800/1500(기본)/2500자 3876~3883
6. 이미지 수 select 0~6장(기본 3) 3885~3894
7. 카테고리 input 3896~3898
8. 예약 날짜/시간/간격 3900~3910
9. CTA 링크/문구 3912~3918
10. 작성 품질 체크박스: SEO 자동조사(기본 on) + 핵심 키워드 강조 3920~3926
11. SEO 참고자료 textarea 3927~3930
12. 기존 작성글 스타일 textarea (style_reference_text — 어투 참고용, 3종 스타일과 별개) 3931~3934
→ 비용 안내 3939, 제출 버튼 3940, 우측 미리보기 패널 3941~3944.
**스타일 3종 선택 컨트롤은 이 폼에 없다.**

## (c) style_id — 잡 생성 경로에서 이미 받아지는가: **예 (서버는 지원, 웹 UI 만 없음)**

- server.js:18083~18085 — 클라이언트 payload 를 `{ ...body.payload }` 로 그대로 받는다.
- server.js:18087~18090 — payload 에 유효한 `style_id`(또는 `style`)가 있으면 **그 값이 그대로 우선**하고, 없을 때만 계정 저장값 폴백. 잡 단위 오버라이드가 이미 성립한다.
- 값 검증은 `yeriStyleKey` (server.js:2098~2103): consult/info/review + 구값 별칭만 통과, 그 외는 빈 값 취급 → 폴백.
- 소비처: 프롬프트 (`yeriStylePack`, 2106~2109 / 라벨 2111~2113) + 구조팩 기본 선택 (`resolveYeriStructurePackId` server.js:2548~2560 — style 이 구조팩 매핑에도 쓰인다).
- 웹 쪽: app.html 에 `style_id` 문자열 0건 (grep 무일치). 예리 제출 payload (app.html:14185~14202) 에 스타일 필드 없음. 즉 폼에 select 하나 추가하고 payload 에 `style_id` 한 줄 실으면 서버 변경 없이 잡 단위 선택이 된다. "지정 안 함(계정 기본값)" 옵션은 필드를 아예 빼면 현재 폴백이 그대로 동작.

## (d) UI 구조 관찰 사실 (의견 아님)

1. **고아 탭**: `#researchTab` (app.html:3701)을 여는 nav 버튼이 없다 (`data-tab="research"` 무일치). "research-tab" 대시보드 액션 (13455~13461)은 researchTab 이 아니라 jobs 탭+송이 선택으로 리다이렉트한다. pageSubtitle 분기 (15200~15201)에는 research 문구가 남아 있다.
2. **단일 파일 규모**: app.html 15,219줄에 HTML+CSS+JS 전부 포함. server.js 19,852줄 단일 파일.
3. **모바일 대응**: viewport meta 있음 (5행). 그러나 브레이크포인트 2개뿐 — 1100px (3086, job-workspace 1열 전환), 900px (3097, 셸 1열 전환). 12그룹짜리 form-grid·테이블에 대한 좁은 화면 전용 규칙은 없다. print (13885) / prefers-reduced-motion (3434) 포함해 @media 총 4개.
4. **설정 탭에 성격이 다른 6종 혼재** (4381~4551): 로컬 설정·실행기(설치/런처), 글쓰기 스타일(콘텐츠 산출 성향), 웹 작업 설정, AI/API 키, 키 발급 가이드. 글의 결과물을 바꾸는 옵션(스타일)이 작업 지시 화면이 아닌 설정 탭에 있다.
5. **예리 폼 정보 밀도**: 한 화면에 12개 옵션 그룹 (3853~3937). 커밋 69bfe5b 가 근거로 든 '실사용률 하락'은 바로 이 폼의 옵션들(카테고리/CTA/SEO/문체참고) 수치다 — 그 폼 구조는 그대로 두고 스타일만 설정 탭으로 갔다.
6. **이름 충돌 소지**: 폼의 "기존 작성글 스타일"(3932~3933, style_reference_text = 어투 참고)과 설정 탭 "글쓰기 스타일"(4410, 3종 구조 선택)이 유사 명칭의 다른 기능이고, 서로 다른 화면에 있다.
7. **알림 배너 4종**이 탭과 무관하게 상단 공통 영역에 쌓인다 (3548~3583).
8. **직원 6명 폼이 jobs 탭 한 패널 안에서 hidden 토글**로 공존 (3846~4369) — 탭 안의 실질적 2차 내비게이션.
9. **스타일 카드 미리보기는 실물 아님**: 회색 블록 스케치 (WRITING_STYLE_PREVIEWS, 12240~12266). 커밋 메시지에 "실제 글 스크린샷은 실행기 배포 후 교체한다"고 미완으로 명시.

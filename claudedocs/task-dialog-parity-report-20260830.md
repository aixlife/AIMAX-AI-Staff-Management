# 리빌드 프리뷰 업무 맡기기 창 — CEO 피드백 반영 결과 (2026-08-30)

- 브랜치: aixlife/task-dialog-parity (base cf62a75) · 커밋 **7de79fc** · push 안 함
- worktree: /Users/aixlife/orca/workspaces/AIMAX-AI-Staff-Management/task-dialog-parity
- 대상: apps/aimax-console-preview (Phase 1 픽스처 전용 유지)

## 1. 실서비스 항목 수 vs 프리뷰 항목 수 (정본: oracle/aimax-reports-api/static/app.html)

| 직원 | 실서비스 입력 항목 | 프리뷰 입력 항목 | 비고 |
|---|---|---|---|
| 예리 (yeriJobForm) | 16 | 17 | 16개 전량 미러 + "이번 글 스타일 템플릿" 카드 1개(프리뷰 추가, CEO 요청 예시 토글 포함) |
| 현주 (hyunjuJobForm) | 6 | 6 | 타겟 블로거 URL은 실서비스처럼 '타겟 블로거 팔로워' 선택 시에만 노출 |
| 윤미 (yunmiJobForm) | 5 | 5 | 공개 직원 신규 추가(아바타 avatar_yunmi.jpg 복사, 이력서 픽스처 작성) |
| 상수 (sangsuJobForm) | 14 | 14 | 작업 항목표도 실서비스와 동일한 항목/내용/금액 구조 + 추가/삭제 |
| 송이 | 폼 폐기 | 0 (안내 화면) | 훔쳐봐 안내로 대체, 옵션 폼 없음 |
| 지은 | 폼 없음(다운로드형) | 다운로드 2종 미러 | Windows Setup v0.1.6 / Apple Silicon Mac v0.2.1 DMG, "실 다운로드 없음" 고지 |

- 3단 접이(필수/자주/고급) 폐기 — `<details>` 0개(테스트로 강제). 섹션 제목으로만 묶음.
- 항목 수는 tests/task-options.test.ts의 `countInputControls`가 회귀 고정 (체크박스는 개수대로 계산).
- DOM 실측: 예리 20개 컨트롤(라디오 4 포함), 상수 19개(항목표 2행x3 포함) — 논리 항목 수와 정합.

## 2. 예상 비용 계산 근거

| 직원 | 근거 | 구분 |
|---|---|---|
| 예리 | 실서비스 단가 그대로: AI_MODEL_PRICES·IMAGE_MODEL_PRICES(app.html 4995-5030), 환율 USD_KRW_RATE=1476(2026-06-24), 토큰 추정식 estimateTokens(input 2200t, output=자수x0.8) 동일 이식. 글+이미지 합산·장당 단가·GPT-5.4 mini 참고가 표기 | 실단가 |
| 윤미 | 기본 초안 0원(실서비스 문구) + AI 생성 전환 시 실단가로 모델별 예상가(자수식 clamp(2200..7000, len+2600) 동일 이식) | 실단가 |
| 현주 | 실서비스에 단가 표기 없음 → "작업량 추정" 라벨 명시: 외부 비용 0원(로컬 실행), 키워드 수 x 키워드당 신청 수, 속도별 건당 90/60/40초 추정 소요 | 추정 |
| 상수 | 실서비스 정책 그대로 외부 비용 0원 + 항목 금액 합계 표시 | 0원+합계 |

계산식·단가는 전부 `src/data/taskOptions.ts`(픽스처 데이터)에 있음. 선택 변경마다 즉시 갱신(aria-live).

## 3. 훔쳐봐 링크 출처

- oracle/aimax-reports-api/server.js:621-643 및 app.html hoomcha 파트너 카드: 명칭 "훔쳐봐", 제작 정보람, externalUrl `https://hoomcha.com/aimax`, ctaLabel "훔쳐봐 체험 시작", 설명·meta(레퍼런스 수집/AI 요약/채널 5종) 동일 인용.
- 프리뷰 소스는 무네트워크 계약 테스트(`https?://` 금지)가 있어 링크는 `hoomcha.com/aimax` 텍스트로 표기하고 앵커 없이 "프리뷰에서는 이동하지 않음"을 고지.

## 4. 검증 결과 (전부 PASS)

- `npm run build` (tsc --noEmit + vite build, NODE_OPTIONS 6144 캡): PASS
- `node --test`: 22/22 PASS — 기존 16건 + 신규 task-options 6건(항목 수 패리티, details 금지, 비용 갱신, 예시 4-6줄, 송이/지은/세무 폼 부재, 윤미 공개 프로필)
- agent-browser 헤드리스 (프로덕션 preview 빌드, 127.0.0.1:4519):
  - 예리: 20컨트롤·4섹션, 스타일 카드 클릭 시 예시 열림/재클릭 닫힘, 비용 192원→(Claude·2500자·6장)427원 갱신, 요약 반영, 업무 생성→업무 페이지 착지
  - 현주: 비용 10건/10분→(2키워드x30·빠름)60건/40분 갱신, 조건부 블로거 URL 노출, 멘트 칸 추가 동작
  - 윤미: 기본 0원 + 모델 전환 시 33원→35원 갱신
  - 상수: 항목 추가 시 합계 180,000→480,000원 갱신
  - 송이: 훔쳐봐 안내 패널·링크 텍스트·파트너 요약 확인
  - 지은: 다운로드 2종·클릭 시 픽스처 고지 표시
  - 공통: Tab 포커스 트랩·Escape 닫힘, 뷰포트 1440/1024/390 가로 스크롤 0, 390px 스크린샷 어절 꺾임 육안 확인(keep-all 정상), 콘솔 에러 0, 이모지·"마법" 없음
- 종료 처리: agent-browser close --all(세션 2개 정리), preview 서버 종료

## 5. 스크린샷 (claudedocs/task-dialog-parity-shots/)

songi-hoomcha-1440/390, jieun-download-1440, yeri-style-example-1440, yeri-form-top-1440, yeri-form-1024, yeri-form-390-top/mid, hyunju-form-1440, yunmi-form-1440, sangsu-form-1440, sangsu-items-390, work-yunmi-confirm-1440, employees-390 (총 14장)

## 6. 잔여·특이사항

- 랜딩 taskChoices의 송이 "경쟁사 조사" 항목은 지시대로 미변경 — 송이 폼 폐기와 정합 여부 후속 판단 필요.
- 세무(semu)는 직원·업무·CSS 전부 제거, WorkPage 폴백 업무(task-tax-008)도 제거.
- 윤미 공개 승격에 맞춰 기존 "키워드 분석" 대기 업무를 "숏폼 스크립트 AI 생성 전환"(39원·Gemini 3.5 Flash) 확인 대기로 교체.
- agent-browser 기본(default) 데몬이 검증 중 wedge되어 SIGTERM 무시 → 격리 세션(parity)으로 우회, 종료 시 close --all로 두 세션 모두 정리됨.

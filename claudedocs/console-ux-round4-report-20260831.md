# 콘솔 프리뷰 UX 4라운드 — CEO 직접 지시분 구현 보고 (2026-08-31)

대상: apps/aimax-console-preview (Phase 1 픽스처 전용) · 브랜치 aixlife/console-ux-round4 (시작점 446ee75)
제외: 카운슬 결정 대기 항목(글쓰기 추천·기본 모델 변경)은 건드리지 않음.

## 구현 내역

### 1. 예리
- 발행 방식 기본값 = 임시 저장(save). 옵션 순서·라벨은 실서비스 app.html:3817 미러(즉시 발행/임시 저장/예약 발행) 그대로, 기본값만 변경.
- 글쓰기 모델에 Gemini 3.7 Flash 추가 — $0.75/$3.75 per 1M, "(신형)" 표기 + "2026-08-13 출시 · 12/31까지 인트로가" 힌트. 추천·기본값은 Gemini 3.5 Flash 유지.
- 이미지 모델 장당 원화 표기(환율 1476, 실서비스 USD 단가 × ceil): gpt-image-1 62원 / gpt-image-2 79원 / Nano Banana 58원 / Nano Banana 2 99원 / Nano Banana Pro 198원. gpt-image-2에 "(추천)" 배지 + 이유 한 줄(이미지 속 한글을 깨지 않는 유일 모델, 2026-08-18 실측). 기본값(gpt-image-1)은 지시에 없어 유지.
- CTA 링크·문구: 스타일 템플릿이 상담 유도형 또는 계정 기본 스타일일 때만 노출(visibleWhen oneOf 신설). 정보 정리형·후기 추천형에서는 숨기되 입력값 보존 — 실측으로 값 보존 확인.

### 2. 현주
- "멘트 초안 만들기" 버튼 복원(실서비스 app.html:4411 generateNeighborMessagesBtn 미러). 누르면 픽스처 멘트 3종이 멘트 칸에 채워지고, "실서비스에서는 AI가 계정 소개를 바탕으로 멘트 초안을 생성합니다" 고지 표시.
- 중복 라벨 전수 스캔 결과: 전 직원(예리·현주·윤미·상수) 섹션 제목=필드 라벨 중복은 **현주 "서로이웃 신청 멘트" 1건뿐**. 섹션에 항목이 1개라 섹션 제목만 남기고 필드 라벨은 hideLabel로 숨김(aria-label은 유지). 재발 방지 테스트 추가(no visible field label duplicates its section title).

### 3. 상수
- 제출 버튼명 "로컬 업무 만들기" → "견적서 생성하기" (상수 전용, 다른 직원은 유지 — 실측 확인).

### 4. 공통 업무 흐름
- 업무 생성 시 업무 페이지로 자동 이동(기존)+ 방금 만든 업무가 목록 맨 위에서 4초간 강조(task-card--just-created 테두리·배경 + "방금 만든 업무" 배지, 자동 해제. reduced-motion은 전역 규칙으로 애니메이션 무효화, 정적 강조는 유지).
- 완료 업무 결과 패널: "미리보기"(기존 DeliverableDialog) + "다운로드" 버튼(전 직원 공통). 다운로드는 브라우저 Blob으로 실제 샘플 .txt 파일을 내려받고 "실서비스에서는 실제 업무 결과 파일이 저장됩니다" 토스트 고지. 외부 전송 없음(신규 src/lib/deliverableFile.ts).

## 검증 (전부 PASS)
- build: tsc --noEmit + vite build PASS. node --test 34/34 PASS(신규·갱신 테스트 포함).
- agent-browser 헤드리스 실측: (a) 예리 기본값 임시 저장·3.7 신형 표시·이미지 장당 원화·gpt-image-2 추천 힌트·CTA 템플릿 연동(info/review 숨김·consult/기본 노출·값 보존) (b) 현주 멘트 초안 3종 채움·중복 라벨 0 (c) 상수 버튼명·생성 후 #/app/work 이동·강조 4초 후 자동 해제 (d) 완료 업무 미리보기 열림·Escape 닫힘·다운로드 토스트. Tab 포커스 모달 내 유지.
- 뷰포트 1440/1024/390 스크린샷, 390px keep-all 어절 꺾임 확인(예리 다이얼로그·현주 멘트·업무 페이지).
- 스크린샷: scratchpad/shots/ (yeri-dialog-1440·1024·390, hyunju-draft-1440·390, work-highlight-1440, work-done-actions-1440, deliverable-preview-1440, work-page-390·1024)

## 시스템 변경 (atomic-design 노트)
- 재사용: select/choice cards/textList/Modal/Toast/TaskCard/DeliverableDialog 기존 패턴 유지.
- 패턴 확장: visibleWhen에 oneOf(다중 값 노출 조건), BaseField.hideLabel(섹션-라벨 중복 제거용), textList.draftFill(픽스처 초안 채우기), task-card--just-created 상태, field-action-row 레이아웃.
- 신규 모듈: src/lib/deliverableFile.ts (텍스트 직렬화 + Blob 다운로드).
- 남은 위험: 다운로드는 헤드리스에서 토스트·클릭까지 실측(파일 저장 자체는 브라우저 표준 동작). 카운슬 결정 후 3.7 추천 전환 시 WRITE_MODEL_CHOICES 라벨·기본값 1곳만 수정하면 됨.

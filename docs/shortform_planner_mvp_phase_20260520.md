# 숏폼 기획자 MVP Phase 준비안

작성일: 2026-05-20  
기준 PRD: `/Users/aixlife/Downloads/ai-shortform-planner-prd.md`  
전제: 기존 코드는 무시하고, 전달된 PRD만 기준으로 MVP를 설계한다.

## 제품 정의

숏폼 기획자는 YouTube Shorts, Reels, TikTok 레퍼런스 링크와 사용자 메모/스크립트를 받아 반복되는 성공 구조를 축적하고, 검증된 패턴을 근거로 A/B/C 숏폼 기획안을 생성하는 AI 직원이다.

핵심 루프:

`프로젝트 생성 -> 레퍼런스 입력 -> 패턴 추출 -> 반복 패턴 검증 -> brief 입력 -> A/B/C 생성 -> 저장/수정/재사용`

## 역할 경계

- 숏폼 기획자: 숏폼 구조 패턴 추출, 검증 패턴 관리, A/B/C 기획안 생성.
- 송이: 별도 자료조사원으로 유지. 필요 시 레퍼런스/브리프를 넘겨줄 수 있지만, 이번 MVP의 필수 선행 조건은 아니다.
- 직원 이름: 미정. 구현 중에는 임시 코드명 `shortform_planner`를 사용한다.

## MVP 원칙

- 인터넷 전체 자동 학습은 제외한다.
- 사용자가 입력한 레퍼런스 기반 학습만 한다.
- 자동 자막/성과 지표/retention 수집은 제외한다.
- 첫 버전은 URL, 메모, 스크립트 붙여넣기 중심이다.
- 단일 레퍼런스 패턴은 `candidate`, 2개 이상 반복된 패턴은 `validated`로 둔다.
- 생성 결과에는 반드시 사용한 근거 패턴을 표시한다.
- paid AI 호출은 서버에서만 수행하고, 실행 전 비용 확인을 둔다.
- 실패 시 자동 유료 재시도하지 않는다.

## Phase 0. 제품 범위와 직원 정체성 고정

목적: 구현이 흔들리지 않도록 숏폼 기획자의 첫 직무를 고정한다.

범위:
- 직원 표시명/임시 코드명 결정
- 송이와의 역할 경계 문서화
- MVP 포함/제외 범위 확정
- 비용 발생 기능과 무료 검증 경로 분리

산출물:
- 최종 직원 정의 문구
- MVP 포함/제외 체크리스트
- 개발용 코드명 `shortform_planner`

검증 기준:
- “이 직원은 예쁜 문장 생성기가 아니라 검증된 숏폼 패턴 기반 기획자”라고 설명 가능하다.
- 자동 트렌드 수집, 성과 대시보드, 협업, 결제, 관리자 기능이 MVP 밖으로 분리되어 있다.

## Phase 1. 데이터 구조와 저장소 골격

목적: 패턴 누적과 생성 결과 재사용이 가능한 최소 데이터 기반을 만든다.

범위:
- `projects`
- `references`
- `extracted_patterns`
- `pattern_clusters`
- `pattern_evidence`
- `generations`
- `generation_pattern_links`

산출물:
- 파일/DB 저장 구조
- CRUD helper
- 샘플 seed 데이터

검증 기준:
- 프로젝트별 레퍼런스가 분리 저장된다.
- 레퍼런스 1개에 추출 패턴 여러 개를 연결할 수 있다.
- 생성 결과와 사용 패턴을 역추적할 수 있다.

## Phase 2. 프로젝트와 레퍼런스 입력

목적: 사용자가 숏폼 연구 단위를 만들고 레퍼런스를 쌓을 수 있게 한다.

범위:
- 프로젝트 생성/조회/수정/삭제
- 카테고리, 설명, 대표 타깃 저장
- URL 입력
- 자유 메모 입력
- 스크립트 붙여넣기
- URL 파싱 실패 시 메모/스크립트 입력 유도

산출물:
- 프로젝트 목록/상세 API
- 레퍼런스 등록 API
- 레퍼런스 상태 모델 `draft -> parsed`

검증 기준:
- 사용자가 프로젝트를 만들고 여러 레퍼런스를 등록할 수 있다.
- URL 없이 메모/스크립트만으로도 레퍼런스를 만들 수 있다.
- URL 파싱 실패가 작업 실패로 끝나지 않고 수동 입력으로 이어진다.

## Phase 3. 패턴 추출 엔진

목적: 레퍼런스에서 숏폼 구조 요소를 일정한 스키마로 뽑는다.

범위:
- `hook_type`: curiosity, direct_address, bold_claim, result_first, tension
- `audience_scope`: niche, broad, mass
- `structure_steps`: hook, result, process, twist, solution, cta
- `cta_type`: comment_keyword, checklist_request, debate, freebie_request
- `tone_type`: informative, sharp, provocative, empathetic
- `evidence_snippet`

산출물:
- 패턴 추출 API
- 추출 결과 저장
- 레퍼런스 상태 모델 `parsed -> extracted`

검증 기준:
- 같은 입력을 반복해도 같은 스키마로 결과가 저장된다.
- 각 패턴은 원문 근거 요약을 가진다.
- 필드 누락이 있어도 전체 작업이 중단되지 않고 보정 가능한 상태로 남는다.

## Phase 4. 패턴 집계와 검증 상태

목적: 단일 의견이 아니라 반복된 구조만 생성 근거로 우선 사용하게 만든다.

범위:
- pattern key 생성
- 같은 유형의 패턴 evidence count 집계
- `candidate`, `validated`, `archived` 상태 관리
- 2개 이상 반복 시 `validated`
- 오래되거나 무시된 패턴은 후순위/archived 가능

산출물:
- 프로젝트별 패턴 목록 API
- 패턴 cluster/evidence 연결
- confidence score 초안

검증 기준:
- 레퍼런스 1개만 있으면 candidate로 남는다.
- 같은 패턴이 2개 이상 반복되면 validated로 올라간다.
- 생성 단계에서 validated 패턴을 우선 조회할 수 있다.

## Phase 5. A/B/C 기획 생성

목적: brief를 받아 타깃 깊이가 다른 3개 숏폼 기획안을 만든다.

범위:
- brief 입력
- 카테고리, 원하는 타깃, 톤 입력
- A안: 가장 뾰족한 타깃형
- B안: 폭넓은 정보형
- C안: 보편/자극/유형테스트형
- 각 안에 3초 후킹, 결과 선제시, 과정 설명, 반전, 솔루션, 댓글 CTA, 30초 내 풀 스크립트 포함

산출물:
- 생성 API
- generation JSON 스키마
- generated 상태 저장

검증 기준:
- A/B/C가 서로 다른 타깃 범위와 전개 방식을 가진다.
- 각 안은 30초 내 숏폼 스크립트로 읽힌다.
- 검증되지 않은 단일 패턴보다 validated 패턴을 우선 사용한다.

## Phase 6. 근거 표시와 결과 편집

목적: 사용자가 왜 이런 기획안이 나왔는지 신뢰하고 재사용할 수 있게 한다.

범위:
- 생성안별 사용 패턴 표시
- 예: “직접 타깃 호출 패턴, 7개 레퍼런스 중 4개에서 반복”
- 결과 저장
- 복사
- 수정
- 재생성

산출물:
- 결과 상세 화면/API
- generation status `generated -> saved -> revised -> exported`
- 근거 패턴 링크

검증 기준:
- 각 생성안에서 사용된 패턴과 evidence count가 보인다.
- 사용자가 결과를 수정해 저장할 수 있다.
- 복사 가능한 출력이 제공된다.

## Phase 7. AIMAX 직원 통합과 안전장치

목적: 숏폼 기획자를 AIMAX의 실제 직원 워크플로우로 붙인다.

범위:
- 직원 카탈로그 등록
- 작업 탭에서 숏폼 기획자 선택
- 베타/준비 상태 표시
- 권한/상품 접근 제어
- paid AI 비용 확인
- 자동 유료 재시도 금지
- 실패 시 기존 오류 보고 흐름 연결

산출물:
- `shortform_planner` 직원 카드
- 작업 입력 폼
- 결과 화면
- 오류 보고 payload 확장

검증 기준:
- 사용자-visible 실패에는 직원명, 작업, 단계, error code/message, source URL/job id, 환경 진단이 포함된다.
- API key, token, password, signed URL, raw provider secret은 오류 보고에 포함되지 않는다.
- 유료 호출 전 확인 없이 생성이 실행되지 않는다.

## Phase 8. MVP 검증과 제한 베타 기준

목적: 제한 베타 전에 핵심 가치 루프가 실제로 작동하는지 확인한다.

범위:
- 샘플 프로젝트 2개 이상
- 프로젝트당 레퍼런스 5개 이상
- 패턴 candidate/validated 상태 검증
- A/B/C 생성 품질 검토
- 저장/수정/복사 흐름 검증
- 실패/예외 처리 검증

산출물:
- MVP 검증 체크리스트
- 제한 베타 오픈/보류 판단
- known issues

검증 기준:
- 레퍼런스 5개를 넣으면 validated 패턴이 생성된다.
- brief 1개로 A/B/C 기획안이 나온다.
- 각 기획안에 근거 패턴이 표시된다.
- 오류 보고로 지원팀이 재현 가능한 sanitized 정보를 받을 수 있다.

## 우선순위 컷

첫 개발 컷은 Phase 1~4까지가 좋다. 생성보다 먼저 `패턴이 쌓이고 검증되는 느낌`이 살아야 이 제품의 차별점이 보인다.

권장 1차 데모:

1. 프로젝트 생성
2. 레퍼런스/스크립트 3개 입력
3. 패턴 추출
4. 2회 이상 반복된 패턴이 validated로 올라가는 화면
5. 생성은 mock 또는 비활성 상태로 두고 “검증 패턴 부족/충분” 안내

권장 2차 데모:

1. 레퍼런스 5개 이상 입력
2. validated 패턴 기반 A/B/C 생성
3. 각 생성안의 근거 패턴 표시
4. 저장/수정/복사

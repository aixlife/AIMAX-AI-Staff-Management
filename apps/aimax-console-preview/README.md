# AIMAX Console Rebuild Preview

프로덕션 AIMAX와 분리된 로그인 없는 로컬 UI/UX 프리뷰입니다.

## 안전 경계

- 이 앱은 local fixture만 사용합니다.
- 로그인, 세션, 사용자 권한, 기존 AIMAX API에 연결하지 않습니다.
- API 키 입력란과 실제 키 저장 기능이 없습니다.
- AI·이미지·Apify·Pexels 등 외부 공급자를 호출하지 않습니다.
- 기존 oracle/aimax-reports-api/server.js와 static/app.html을 수정하지 않습니다.
- 이 프리뷰에서 만든 업무와 오류 접수는 브라우저 메모리에만 존재합니다.

따라서 로그인 없이 열린다는 것은 프로덕션 인증 우회가 아니라, 인증 시스템 자체를 사용하지 않는 별도 앱이라는 뜻입니다.

## 실행

Node.js 22 이상이 필요합니다.

    cd /Users/aixlife/Projects/AIMAX-AI-Staff-Management/apps/aimax-console-preview
    npm install
    npm run dev

브라우저에서 다음 주소를 엽니다.

    http://127.0.0.1:4175/

빌드 결과 확인:

    NODE_OPTIONS='--max-old-space-size=6144' npm run build
    npm run preview

프로덕션 빌드 프리뷰 주소:

    http://127.0.0.1:4176/

## 로컬 검토 순서

1. 상단 LOCAL PREVIEW 배너가 항상 보이는지 확인합니다.
2. 홈에서 확인 필요, 실행 중, 최근 결과가 행동 우선순위대로 보이는지 확인합니다.
3. AI 직원에서 검색·실행 방식 필터·직원 상세·업무 맡기기를 확인합니다.
4. 새 업무 dialog에서 확인 체크 전에는 로컬 업무 생성 버튼이 비활성인지 확인합니다.
5. 업무에서 확인 필요 항목의 비용 확인, timeline, 완료 결과, 실패 복구 상태를 확인합니다.
6. 연결 및 설정에서 키 입력 없이 status-only 카드 구조를 확인합니다.
7. 도움말에서 오류 보고 미리보기를 제출하고 “서버 전송 없음” 접수증을 확인합니다.
8. 상단 화면 상태를 일반 운영, 확인 필요 집중, 연결 오류, 첫 사용자, 긴 콘텐츠로 각각 바꿉니다.
9. 브라우저 폭을 모바일 크기로 줄이고 하단 내비게이션과 모든 핵심 행동을 확인합니다.
10. 키보드 Tab, Shift+Tab, Enter, Space, Escape로 내비게이션·dialog·폼을 확인합니다.

## 이번 Phase에 포함되지 않는 것

- 기존 API와 실제 데이터 연동
- 프로덕션 로그인·권한·직원 entitlement
- 기존 직원별 모든 업무 폼
- 실제 오류 보고 전송
- 카드뉴스 생성 API와 편집기
- admin/setup 리빌딩
- staging 또는 production 배포

세부 이관 기준은 docs/FUNCTIONAL_PARITY_MATRIX.md에 기록합니다.

## 브랜치와 되돌리기

현재 작업 브랜치:

    codex/aimax-ui-rebuild-preview

아직 main 또는 프로덕션에는 적용되지 않습니다. 로컬 프리뷰를 폐기하려면 main으로 전환하면 됩니다.

    git switch main

브랜치 삭제는 검토 기록이 더 이상 필요 없다고 사용자가 명시적으로 결정한 경우에만 수행합니다.

## 다음 승인 게이트

사용자가 로컬 시각·기능 검토를 완료한 뒤에만 다음을 진행합니다.

1. 기존 API 응답 계약을 adapter로 연결
2. 프로덕션 로그인과 entitlement 유지
3. 기존 화면과 신 화면의 기능 패리티 자동 검증
4. feature flag 또는 별도 staging branch 배포
5. 사용자 승인 후 점진 전환

배포와 main 병합은 별도의 명시적 승인 없이는 실행하지 않습니다.

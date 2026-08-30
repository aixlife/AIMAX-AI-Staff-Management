# AIMAX Landing + Console Rebuild Preview

프로덕션 AIMAX와 분리된 로그인 없는 로컬 UI/UX 프리뷰입니다. 메인 진입은 공개 랜딩페이지이고, 로그인 후 제품에 해당하는 운영실은 별도 경로로 분리했습니다.

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

1. 첫 진입이 운영 대시보드가 아니라 공개 랜딩인지 확인합니다.
2. 공개 헤더에 로그인 버튼이 없고 로컬 검토용 `운영실 체험`만 있는지 확인합니다.
3. 첫 화면은 예리의 블로그 초안으로 시작하고, 업무·담당 직원·결과 카드가 자동으로 순환하는지 확인합니다. 업무 버튼으로 직접 선택할 수도 있습니다.
4. `A TEAM WITH NAMES` 구간이 화면에 머무는 동안 스크롤에 맞춰 송이·예리·현주·상수·지은이 차례로 선택된 것처럼 전환되고, 지은 다음에 입사지원서 구간으로 풀리는지 확인합니다.
5. 각 직원의 `입사지원서 보기`를 눌러 국내형 증명사진·인적사항·자기소개·경력·기술·추천사·면접 메모를 확인합니다.
6. `맡길 일 → 직원이 처리 → 대표님이 결정` 흐름과 전체 모션 정지 버튼을 확인합니다.
7. `운영실 체험`으로 로그인 없이 `#/app/home`에 들어갑니다.
8. 홈에서 확인 필요, 실행 중, 최근 결과와 직원 사진이 함께 보이는지 확인합니다.
9. AI 직원에서 검색·필터·입사지원서·업무 맡기기를 확인합니다.
10. 업무, 연결 및 설정, 도움말과 화면 상태 fixture를 각각 확인합니다.
11. 1440px, 1024px, 390px와 키보드 Tab·Enter·Escape·reduced-motion 환경을 확인합니다.

스크롤 직원 소개는 Scrollama의 sticky stage + step 패턴을 CSS `sticky`, `requestAnimationFrame` 스크롤 진행률, `IntersectionObserver` 등장 효과로 구현했습니다. Motion·Lenis 등 새 런타임 의존성은 추가하지 않았습니다.

## 경로 구조

- `#/`: 공개 랜딩페이지
- `#/app/home`: 로그인 후 운영실에 해당하는 로컬 체험 홈
- `#/app/employees`: 직원 목록·프로필·이력서
- `#/app/work`: 업무 상태·결과
- `#/app/connections`: 연결 및 설정
- `#/app/help`: 오류 보고와 지원

실제 배포 단계에서는 hash 경로를 `/`, `/login`, 보호된 `/app/*` 라우팅으로 교체할 예정입니다. 이 변경은 현재 Phase에 포함되지 않습니다.

## 이번 Phase에 포함되지 않는 것

- 기존 API와 실제 데이터 연동
- 프로덕션 로그인·권한·직원 entitlement
- 운영 도메인의 `/`, `/login`, `/app` 실제 라우팅
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

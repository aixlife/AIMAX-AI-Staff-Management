# AIMAX Site Tour Maintenance

## Purpose

`AIMAX 사이트 둘러보기`는 신규 사용자가 사이트 전체 구조를 먼저 이해하게 하는 1차 가이드다. 특정 직원, 실행기 연결, API 키 준비 여부와 상관없이 열려야 한다.

## Tour Scope

- 대시보드: AIMAX 전체 그림과 다음 행동
- 직원 채용: 직원 카탈로그와 사용 가능 상태
- 직원 업무지시: 직원 선택, 실제 작업 입력, 작업 기록
- 설정: 웹 작업 설정, AI/API 연결, 로컬 설정 상태
- 업데이트 및 오류보고: 설치 파일, 버전 상태, 오류 보고
- 직원 피드백: 오류가 아닌 사용 경험과 개선 요청

## Maintenance Contract

- 사이트 전체 가이드의 source of truth는 `oracle/aimax-reports-api/static/app.html`의 `featureTours.aimax_site_overview`다.
- 각 단계는 실제 화면 요소의 `data-guide-id`만 참조한다.
- 탭 이름, 주요 섹션 DOM, 또는 신규 사용자 첫 화면 구조가 바뀌면 같은 변경에서 `featureTours.aimax_site_overview`와 `data-guide-id`를 함께 수정한다.
- 이 가이드는 실행기 연결을 중심으로 만들지 않는다. 실행기/설치/업데이트는 AIMAX 운영 구역 중 하나로만 설명한다.
- 직원별 상세 사용법은 별도 미니 가이드로 분리한다. 예: `featureTours.yeri_first_job`.

## Required Checks

```bash
node scripts/validate_feature_tours.mjs
node -e "const fs=require('fs'); const html=fs.readFileSync('oracle/aimax-reports-api/static/app.html','utf8'); for (const m of html.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)) new Function(m[1]); console.log('app.html script ok')"
```

## Manual Smoke

1. 로그인 후 상단 `사이트 둘러보기` 버튼을 누른다.
2. 가이드가 실행기 연결 여부와 상관없이 시작되는지 확인한다.
3. `다음`을 누르며 대시보드, 직원 채용, 업무지시, 설정, 업데이트/오류보고, 피드백 탭으로 이동하는지 확인한다.
4. 각 단계의 강조 영역이 사용자가 실제로 봐야 할 탭/섹션과 맞는지 확인한다.
5. `이전`, `그만 보기`, `ESC`가 동작하는지 확인한다.

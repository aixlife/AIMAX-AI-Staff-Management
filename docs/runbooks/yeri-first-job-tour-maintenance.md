# Yeri First Job Tour Maintenance

## Purpose

예리 첫 업무지시 가이드는 신규 사용자가 `직원 업무지시 -> 예리 -> 키워드 -> 발행 방식 -> AI 모델 -> 비용 안내 -> 업무지시` 흐름을 화면 위에서 따라가게 하는 스포트라이트 가이드다.

## Maintenance Contract

- 가이드 단계의 source of truth는 `oracle/aimax-reports-api/static/app.html`의 `featureTours.yeri_first_job`이다.
- 각 단계는 반드시 실제 화면 요소의 `data-guide-id`만 참조한다.
- 예리 입력칸, 발행 방식, AI 모델, 비용 안내, 제출 버튼의 DOM을 삭제/이름 변경/조건부 렌더링으로 바꾸면 같은 변경에서 `featureTours.yeri_first_job`와 `data-guide-id`를 함께 수정한다.
- 새로 추가되는 예리 옵션을 모두 가이드에 넣지 않는다. 신규 사용자의 첫 성공에 꼭 필요한 단계만 유지한다.
- 비용, 유료 호출, 네이버 임시저장, 오류 보고 관련 문구가 바뀌면 가이드 문구도 함께 점검한다.

## Required Checks

```bash
node scripts/validate_feature_tours.mjs
node -e "const fs=require('fs'); const html=fs.readFileSync('oracle/aimax-reports-api/static/app.html','utf8'); for (const m of html.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)) new Function(m[1]); console.log('app.html script ok')"
```

## Manual Smoke

1. 로그인 후 `직원 업무지시`에서 예리 폼을 연다.
2. `처음 쓰기 가이드`를 누른다.
3. `다음`, `이전`, `그만 보기`, `ESC`가 동작하는지 확인한다.
4. 각 단계의 강조 영역이 실제 눌러야 하는 메뉴/입력칸/버튼과 맞는지 확인한다.
5. 모바일 폭에서도 팝업이 화면 밖으로 나가지 않는지 확인한다.

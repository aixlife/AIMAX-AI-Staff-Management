# AIMAX AI Staff Management

AIMAX 운영 웹앱, Local Agent, AI 직원 워크플로우, 배포/검증 스크립트를 함께 관리하는 소스 저장소입니다.

## 주요 구성

- `oracle/aimax-reports-api/`: 운영 웹앱/API 서버와 정적 UI
- `local_agent/`: Mac/Windows 설치 실행기 런타임
- `content/`, `posting/`, `browser/`, `engagement/`: 예리/현주 작업 로직
- `scripts/`: smoke, 배포, 운영 점검 스크립트
- `docs/`: 배포 기록, 테스트 증거, 의사결정, 운영 문서
- `handoffs/`: Mac/Windows 협업 전달 문서
- `memory/`: 프로젝트 durable memory

## GitHub에 포함하지 않는 것

`.gitignore`는 다음을 제외합니다.

- `.env`, passphrase, token, cookie, credential 파일
- `venv`, `__pycache__`, build cache
- `dist`, `build`, installer/DMG/EXE/ZIP 산출물
- 과거 handoff source bundle/source-files 복제본
- local research/council run 결과

대용량 산출물은 필요 시 archive 위치에서 복구합니다.

## 기본 검증

```bash
node --check oracle/aimax-reports-api/server.js
node scripts/smoke_worker_catalog_contract.mjs
node -e 'const fs=require("fs"); const html=fs.readFileSync("oracle/aimax-reports-api/static/app.html","utf8"); const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim()); for (const script of scripts) new Function(script); console.log(`app.html script ok ${scripts.length}`);'
```

유료 AI/API, Apify, Naver 발행/예약 테스트는 명시 승인 없이 실행하지 않습니다.

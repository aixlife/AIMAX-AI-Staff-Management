# Mac Completion - v116 Web Secret Notice Ready

작성 시각: 2026-05-22 20:00 KST

## 결론

Mac/Oracle 웹 쪽 변경은 완료 및 배포 검증까지 끝났습니다.
Windows 쪽은 로컬 설정 문구가 반영된 소스 기준으로 설치본 재빌드가 필요합니다.

## Mac/Oracle 반영 내용

- 웹 설정 탭에 사용자별 `AI/API 연결` 저장소가 유지됩니다.
- 송이 자료조사원은 Apify/Gemini 키를 웹 보안 저장소에서 우선 사용합니다.
- 신규 안내 팝업을 추가했습니다.
  - 제목: `AIMAX 설정 방식이 더 쉬워졌습니다`
  - 대상: 송이 또는 전체 통합 권한 사용자
  - 버튼: `AI/API 연결 열기`, `나중에 하기`
  - 오류 보고 확인 필요 팝업이 떠 있을 때는 겹쳐 뜨지 않습니다.
- Windows 반환 소스의 로컬 설정 안내 문구를 Mac 기준 소스에도 반영했습니다.
  - 로컬 실행기 설정창의 AI/API 키는 블로그팀 로컬 작업용임을 명확히 표시
  - 송이 자료조사용 provider 키는 웹 설정 탭의 `AI/API 연결`에서 관리한다고 안내

## 배포

- Oracle web 배포 완료
- 배포 보고서: `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/docs/deployments/oracle-deploy-20260522-195819.md`
- 공개 헬스체크: `https://api.aimax.ai.kr/api/reports/health` -> `ok: true`
- 공개 웹앱 확인:
  - `AIMAX 설정 방식이 더 쉬워졌습니다`
  - `AI/API 연결`
  - `WEB_SECRET_NOTICE_KEY`
  - `웹 보안 저장소`

## 검증

무비용 검증만 수행했습니다.

- `node --check oracle/aimax-reports-api/server.js`
- `python -m py_compile app.py split_version/app.py local_agent/runtime.py`
- `APP_HTML_SCRIPT_SYNTAX_OK`
- `node --check scripts/smoke_user_secrets.mjs`
- `USER_SECRETS_SMOKE_OK`

## 주요 SHA256

| file | sha256 |
|---|---|
| `app.py` | `c3c4d291bb06ea06edaed6206f3d9c1421799c480c795ff25b8f6567c808a562` |
| `split_version/app.py` | `a9c0a2f64bb5889bd7b027b03f9b5791859dd20c177e14531f5eee9a877ee618` |
| `local_agent/runtime.py` | `1912b9b4bd7b49769decdb344edb2bf6952b13f5e0ab687aa6d334bb47a41e35` |
| `oracle/aimax-reports-api/static/app.html` | `93050c31b3930194e807f6930a86110a8b385b6521337bb75f7ad5bd2e2297a9` |
| `oracle/aimax-reports-api/server.js` | `97a03718cfc8166e73f93aebbf51a1b5934b6098bb65d4c131f9529c2682cd1a` |
| `scripts/smoke_user_secrets.mjs` | `02c3e4e3e9e1eb9156051700ee2c52fbda1d1ee7d042d6ba9880ecf50eb3db89` |

## Windows 주의

- Mac 로컬 `aimax_compliance.py`는 오래된 버전값을 가질 수 있으므로 Windows 작업 폴더의 현재 버전을 우선합니다.
- 현재 Windows 기준이 `v1.0.15`라면 재빌드 산출물은 `v1.0.16`으로 올리는 것을 권장합니다.
- 절대 Mac 소스의 오래된 버전값으로 Windows 설치본 버전을 낮추지 마세요.
- 실제 Naver 저장/발행, Apify Actor 실행, 유료 AI 호출은 하지 않았습니다.

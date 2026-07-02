# Windows Handoff — AI 기본모델 flash 복귀 + 강제 pro-preview 마이그레이션 + 키 사전검증

- 날짜: 2026-06-03
- 작성: Mac 측 (소스 수정 담당)
- 대상: Windows 측 (빌드/검증)
- 선행 요청: `20_Deploy-To-Mac/2026-06-02-api-key-model-default-investigation/MAC_HANDOFF_20260602_ai_generation_apikey_model_default.md`

## 0. 한 줄 요약
"AI 글 생성 실패(모델/키/사용량)" 다발의 체계적 원인이었던 **기본 모델 = `gemini-3.1-pro-preview`(무료 등급에서 막힘)** 를 **`gemini-2.5-flash`** 로 되돌리고, 이미 pro-preview 가 저장된 기존 사용자도 1회 자동 복귀시키며, 만료/무효 키를 생성 시도 전에 명확히 안내하도록 수정.

## 1. 무엇이 바뀌었나 (소스)

### Windows .exe 에 포함되는 변경 (rebuild 필요) — `app.py`, `content/ai_text.py`
1. **기본 모델 → `gemini-2.5-flash`** (RULES/안내서 기준값)
   - `app.py` `_DEFAULT_AI_MODEL`, 모델 드롭다운 ★기본 표시, 도움말 비용표
   - `content/ai_text.py` `generate_blog_content`/`_normalize_gemini_model_id`/`_generate_with_gemini` 기본·폴백
   - `gemini-3.1-pro-preview` 는 "유료/고급" 선택지로 **유지**(삭제 아님). 명시적으로 고르면 그대로 동작.
2. **별칭 강제 업그레이드 제거**: `gemini-2.5-pro`(구 기본값) → 이제 `gemini-2.5-flash` (이전엔 pro-preview 로 강제 업글되어 무료 사용자 실패 유발). 명시적 `gemini-3.1-pro` 만 유료 프리뷰로 유지.
3. **저장된 pro-preview 1회 마이그레이션** (`migrate_forced_pro_preview_default`, `load_settings` 진입 시 호출)
   - 기본값이 pro-preview 이던 기간에 설정을 저장한 사용자의 `settings.json` 에 박힌 `gemini-3.1-pro-preview` 를 `gemini-2.5-flash` 로 **1회만** 되돌리고 `forced_pro_preview_default_migrated` 플래그를 남긴다.
   - 마이그레이션 후 사용자가 다시 pro-preview 를 **명시적으로** 고르면 그 선택은 보존된다(화이트리스트 유지).
4. **키 사전검증** (`precheck_gemini_key`, `generate_blog_content` 에서 호출)
   - 무료 ListModels 1건으로 키 유효성 점검 → 만료/무효면 생성 시도(및 재시도) 전에 "키 인증 실패" 즉시 노출. 같은 프로세스에서 통과한 키는 캐시해 대량 발행 시 중복 호출 방지.

### Oracle 웹 배포 (Windows .exe 와 무관) — `oracle/aimax-reports-api/static/app.html`
5. **에러 정밀 사유 노출(#3)**: content_generation 실패 시 백엔드의 분류 메시지를 웹 분기가 잡도록 한국어 키워드 보강 (quota/apikey 분기에 `사용량/한도 초과/요금제`, `키 인증 실패/인증 실패/키를 확인/api key expired/api_key_invalid`). 백엔드는 이미 사유를 분류해 전달하므로 **백엔드 변경 없음**. 이 항목은 Oracle 정적 파일 배포로 적용 — Windows 빌드와 별개.

## 2. Windows 측이 할 일

1. 동기화된 Mac 소스로 **.exe rebuild** (`AIMAX.spec`, `collect_all('google.genai')` 포함되어 SDK 번들 OK).
2. 아래 **실제 검증**(스모크 아님) 수행. 결과서 회신.

## 3. 검증 — 반드시 실제 동작 테스트 (스모크/목 금지)

> 키 무관 항목은 즉시 검증 가능. 생성 "성공" 만 유효 키가 필요(현재 양쪽 키 만료 — Mac/Windows 동일 블로커).

1. **기본값 flash** — 설정을 한 번도 저장 안 한 새 프로필로 실행 → 모델 기본 선택이 "Gemini 2.5 Flash ★기본" 인지 UI 에서 확인.
2. **마이그레이션(실데이터)** — `settings.json` 에 `"ai_model": "gemini-3.1-pro-preview"` 를 넣고 앱 실행 → 실행 후 파일이 `"gemini-2.5-flash"` 로 바뀌고 `forced_pro_preview_default_migrated: true` 가 생기는지 확인.
3. **명시적 재선택 보존** — 마이그레이션 후 드롭다운에서 "Gemini 3.1 Pro Preview (유료/고급)" 선택·저장 → 다시 실행해도 pro-preview 가 유지되는지(다시 flash 로 안 바뀜) 확인.
4. **키 사전검증(만료 키, 과금 없음)** — 만료된 Gemini 키 상태로 글 생성 시도 → 생성 진입 전에 "Gemini API 키 인증 실패 - 키를 확인/갱신" 류의 명확한 사유가 즉시 뜨는지 확인(무료 ListModels 라 과금 없음).
5. **생성 성공(유효 키 필요 — 블로커)** — 유효 Gemini 키로 flash 1회 실제 생성 성공 확인. 키 없으면 "Naver/생성 미실행"으로 명시.
6. (Oracle 웹) #3 는 Oracle 정적 배포 후, 실패 케이스에서 "AI API 키 확인 필요" / "AI API 사용량 또는 쿼터 초과" 가 구분되어 보이는지 웹에서 확인.

## 4. Mac 측 실제 테스트 결과 (이미 수행, 스모크 아님)

- 마이그레이션: 이 PC 실제 `settings.json` 복사본(= pro-preview 저장 상태)으로 5/5 통과 — pro-preview→flash 변환, `load_settings` 반영, 멱등성, 명시적 재선택 보존, 재선택 후 load 유지.
- #4 사전검증: 실제 만료 키로 호출 → `AiQuotaError "Gemini API 키 인증 실패..."` 정상 반환(실제 ListModels, 실제 인증 실패 감지). 빈 키도 적절 메시지.
- #3 라우팅: 실제 백엔드 분류 메시지를 실제 app.html 분기 조건(node 평가)으로 검증 — auth→apikey, quota→quota 정확.
- 컴파일: `app.py`, `content/ai_text.py` py_compile OK / app.html JS 파싱 OK.
- **미수행(블로커)**: flash 로의 실제 생성 "성공" — 양쪽 Gemini 키 만료로 유효 키 확보 시 수행 예정.

## 5. 주의 / 한계

- **WIP 얽힘**: 이 변경은 Mac 작업트리의 광범위한 미커밋 WIP(앱 UI 리디자인, AiQuotaError 재작성, 프롬프트 등) 한가운데에 얹혀 있어 단독 분리 커밋이 어렵다. 동기화되는 소스는 그 WIP 도 함께 포함된다(별도 합의 전까지 커밋/동기화 보류 중).
- pro-preview 를 **의도적으로** 쓰던 유료 사용자도 1회 마이그레이션으로 flash 로 내려간다. 재선택하면 유지됨(2번/3번 검증 항목).
- 만료/무효 키는 코드로 못 고친다(사용자별). #3/#4 는 사유를 **명확히** 할 뿐. 각 사용자 키 갱신 필요.
- no-secrets: 키 값 미기재. no-paid: 분석/검증은 무료 ListModels 만, 생성(과금) 호출 없음.

## 6. 결과 보고

`WINDOWS_RESULT_20260603_ai_model_default_flash.md` 에:
전체 PASS/BLOCKED, Windows/앱 버전, rebuild 결과, 위 1~5 검증 증거(특히 마이그레이션 파일 변화 before/after), 생성-성공 실행 여부(키 유무), no-paid/no-secrets 명시.

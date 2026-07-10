# Spec: 예리 블로그 문체 학습 구현 → gpt-5.6-sol, effort xhigh

승인된 Phase 2 설계안(2026-07-10 CEO 게이트 통과) 기반. 원 스펙 `claudedocs/yeri-naver-blog-research-integration-2026-07-10.md`의 "codex-skills 이식" 경로는 기각됨(배포 번들 미포함 확인) — 러너 소스 트리 정식 모듈로 포팅한다. 구현 중 설계 모순 발견 시 임의 변경하지 말고 보류 표시 후 보고.

## 목표

앱 사용자가 자기 네이버 블로그 주소를 등록하면 예리가 그 블로그의 공개 글을 로컬에서 수집해 문체 프로필을 만들고, 이후 yeri_write 글 생성 시 그 문체를 `style_reference_text`로 반영한다.

## 컨텍스트 (읽어야 할 파일·기존 패턴)

- 참조 구현 (MIT, k-skill 업스트림 — 로직 포팅 원본): `.claude/skills/naver-blog-research/scripts/` — `naver_read.py`(모바일 표면 원문 추출, iframe 우회), `naver_search.py`, `_naver_http.py`(헤더·타임아웃 유틸). python3 stdlib만 사용.
- `content/ai_text.py:114-183` — `generate_blog_content(..., style_reference_text=...)` 훅이 이미 존재. `_style_reference_instruction()`(156행)이 "복사 금지, 톤만 참고" 지시문으로 프롬프트에 주입. 이 훅을 그대로 사용하고 프롬프트 템플릿은 수정하지 않는다.
- `app.py:6458` — generate_blog_content 호출부 (style_reference_text 전달 지점). `app.py:3751-3754` — yeri_write 잡 진입. `app.py:3783` 근처 `_remote_write_kwargs`.
- `paths.py:48-53` — `APP_DATA_DIR`, `GENERATED_DIR`, `SETTINGS_PATH` 패턴. 신규 디렉토리는 같은 패턴으로 `STYLE_PROFILES_DIR: Path = APP_DATA_DIR / "style_profiles"` 추가.
- `app.py:988-1003` — settings.json 로드/저장(_load_settings_data/_save_settings_data), `app.py:5074-5081` — 설정 UI 패널·저장 버튼. Tk 변수(StringVar/BooleanVar) ↔ settings dict 동기화 패턴.
- `content/seo_research.py` — urllib.request 기반 기존 HTTP 수집 코드 (스타일 참고).
- `AIMAX.spec:16-29` — hiddenimports: `collect_submodules('content')`, `collect_submodules('local_agent')`. 신규 모듈은 app.py에서 정적 import 하면 자동 포함되지만, `scraper` 하위에 넣을 경우 spec의 hiddenimports에 이미 포함되는지 확인하고 필요 시 명시 추가.
- AI 키 선택: `app.py:6252-6257` (claude/openai/gemini 키 분기) — 문체 프로필 생성도 같은 분기·같은 사용자 키를 사용.

## 구현 항목

### 1. 수집 모듈: `scraper/blog_style_collector.py` (신규)

- `.claude/skills/naver-blog-research/scripts/`의 로직을 stdlib-only로 포팅 (Selenium 사용 금지 — 수집은 브라우저 없이 HTTP만).
- 입력: 블로그 주소(blog.naver.com/{id}, m.blog.naver.com/{id}, 순수 id 전부 허용 — 정규화 함수 포함).
- 동작: 공개 글 목록 조회 → 최신 글 최대 30개의 원문 텍스트 추출(모바일 표면). 이미지 다운로드는 하지 않는다.
- 속도 제한: 요청 간 최소 1.5초 간격. HTTP 429/403/차단 감지 시 즉시 중단하고 부분 결과 + 명확한 에러 상태 반환 (재시도 금지).
- 실패 안전: 존재하지 않는 블로그·비공개·글 0개 → 예외가 아닌 구조화된 결과 `{ok: False, reason: ...}` 반환.
- 저장: 원문은 `STYLE_PROFILES_DIR / "{blog_id}_posts.json"`에만 저장. 서버 전송 경로를 만들지 않는다.
- 파일 헤더에 업스트림 출처 주석: k-skill naver-blog-research (MIT).

### 2. 문체 프로필 생성: `content/style_profile.py` (신규)

- 수집 글들(합쳐서 토큰 한도 내 샘플링 — 글당 앞부분 위주, 총 입력 제한)을 사용자의 기존 AI 키·모델로 1회 분석 호출.
- 산출: 문체 프로필 텍스트 (어휘 습관, 문장 길이 경향, 종결어미 패턴, 문단 구성, 자주 쓰는 표현). 800자 이내 한국어.
- 저장: `STYLE_PROFILES_DIR / "{blog_id}_style.json"` — 프로필 텍스트 + 생성일 + 원본 글 개수.
- AI 호출은 `content/ai_text.py`의 기존 요청 유틸/모델 분기를 재사용 (신규 HTTP 클라이언트 금지).

### 3. 설정 UI + settings.json (app.py)

- 설정 패널에 추가: "내 블로그 주소" 입력창, "문체 학습 시작" 버튼, "글 쓸 때 내 문체 반영" 체크박스, 마지막 학습 상태 라벨(학습일·글 개수 또는 미학습).
- settings.json 신규 키: `style_blog_url`, `style_profile_enabled` (기존 로드/저장 패턴 그대로).
- "문체 학습 시작"은 백그라운드 스레드로 실행 (기존 앱의 스레드 패턴 재사용) — UI 프리즈 금지. 진행/완료/실패를 상태 라벨로 표시.
- 학습 완료 전 토글을 켜면 안내 후 무시 (프로필 없으면 주입 생략).

### 4. 주입 배선 (app.py)

- yeri_write 실행 경로에서: `style_profile_enabled`이고 프로필 파일이 존재하면 프로필 텍스트를 `style_reference_text`로 전달. 기존에 style_reference_text를 채우는 다른 경로가 있으면 **기존 값 우선, 프로필은 비어 있을 때만** (기존 동작 회귀 금지).
- 검수 옵션(선택 토글, 기본 꺼짐): `humanize_review_enabled` settings 키 + 설정 체크박스. 켜져 있으면 글 생성 직후 같은 AI 모델로 1회 추가 패스 — "AI 상투 표현·번역체 제거, 의미 보존" 지시. 실패 시 원문 그대로 진행 (검수 실패가 글 생성을 막으면 안 됨).

## 제약 (하지 말 것)

- 로그인 세션·쿠키를 수집에 사용하지 않는다. 차단 우회(User-Agent 위장 이상의 회피, 프록시) 금지.
- 타인 블로그 문체 모사를 기능으로 노출하지 않는다 (입력은 "내 블로그 주소" 라벨, 검증은 하지 않되 UI 문구로 본인 블로그 전제 명시).
- 수집 원문·프로필을 서버로 업로드하는 코드 경로를 만들지 않는다.
- 신규 pip 의존성 금지 (stdlib + 기존 의존성만). Selenium을 수집에 쓰지 않는다.
- 서버(oracle/) 및 기존 발행 자동화(auth/, posting/) 코드 수정 금지.
- 프롬프트 템플릿(content/prompts.py) 수정 금지 — 주입은 기존 훅으로만.
- 이모지 금지, "마법" 표현 금지 (UI 문구 포함).

## 불변식

- 기존 yeri_write 플로우: 문체 기능 미사용 시(토글 꺼짐/프로필 없음) 동작이 현재와 완전히 동일.
- settings.json 하위 호환: 신규 키 없는 기존 파일 로드 시 기본값으로 동작, 에러 없음.
- `python3 -m py_compile app.py content/ai_text.py content/style_profile.py scraper/blog_style_collector.py` 통과.
- PyInstaller 번들에 신규 모듈 포함 (AIMAX.spec 확인·필요 시 hiddenimports 추가).

## 검증 기준 (통과 판정)

```
python3 -m py_compile app.py paths.py content/style_profile.py scraper/blog_style_collector.py
python3 scripts/test_style_learning_offline.py   # 신규 오프라인 테스트 (아래)
```

- 신규 오프라인 테스트 `scripts/test_style_learning_offline.py`: HTTP·AI 호출을 스텁으로 치환해 (1) 주소 정규화 3형태 (2) 수집 성공→프로필 저장→주입 텍스트 생성 (3) 비공개/글 0개/429 안전 실패 (4) 토글 꺼짐 시 style_reference_text 미주입 (5) 기존 settings.json(신규 키 없음) 로드 호환 — 전부 PASS.
- 실블로그 수집 스모크(네트워크 1회, 요청 간격 준수): 공개 블로그 1개에서 글 3개 원문 추출 성공을 확인하는 스크립트 실행 흔적 포함 (수집 대상 주소는 실행자가 지정).
- 완료 보고에 변경 파일 목록 + 테스트 실행 로그 포함.

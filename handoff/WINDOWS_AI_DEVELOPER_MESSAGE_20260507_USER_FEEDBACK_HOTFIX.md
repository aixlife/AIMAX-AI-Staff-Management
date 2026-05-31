# Windows AI Developer Message — User Feedback Hotfix

아래 지시를 그대로 따르세요.

## 핵심 상황

실제 Windows 사용자가 AIMAX를 설치하고 테스트했습니다. 기능은 결국 동작했지만, 중간 상태 반영과 실패 진단이 불안정하게 느껴진다는 피드백이 들어왔습니다.

이번 작업의 목표는 새 기능 추가가 아니라 **Windows 사용자 체감 안정화**입니다.

## 사용자 피드백 요약

1. 네이버 블로그 계정/API Key를 입력했는데 대시보드에 바로 반영되지 않았습니다.
2. 사용자는 반영이 늦어서 `실행기 연결`을 여러 번 눌렀습니다.
3. 예리 역할명이 `소통글쓰기 직원`으로 보여서 어색합니다. `블로그 글쓰기 직원`이 맞습니다.
4. 블로그 글쓰기 실행 중 첫 시도에서 로그인/브라우저 세션 오류가 발생했고, 다시 하니 진행됐습니다.
5. 작업목록에서 실패한 경우 어떤 키워드/어떤 단계에서 실패했는지 더 잘 보여야 합니다.
6. 발행된 글에서 볼드 처리 이후 키워드가 한 번씩 반복되는 현상이 있었습니다.

대표 오류:

```text
자동화 직원교육 처리 실패: Message: invalid session ... as the browser has closed the connection from disconnected: not connected to DevTools ... chrome=147.0.7727.138
```

## 절대 하지 말 것

- 네이버 비밀번호/API Key를 서버나 웹앱 DB에 저장하지 마세요.
- 복호화된 `.env`나 API Key 원문을 Syncthing 폴더에 올리지 마세요.
- paid generation 테스트를 임의로 하지 마세요. 실제 Gemini/OpenAI/Claude 글 생성, 이미지 생성, 네이버 발행 테스트는 사용자 승인 후에만 합니다.
- 같은 paid 작업을 재시도할 때 새 AI 글 생성을 다시 호출하지 마세요. 이미 생성된 원고가 있으면 재사용해야 합니다.
- Windows에서만 완전히 갈라진 구현을 만들지 마세요. 가능한 공통 코드에 넣고, OS별 처리는 작은 helper로 격리하세요.
- `oracle/aimax-reports-api/server.js` 또는 `oracle/aimax-reports-api/static/app.html`을 임의 배포하지 마세요. 이 파일들은 Mac/Oracle 운영 배포 담당 영역입니다.

## 작업 범위

### 1. 로컬 설정 저장 직후 즉시 readiness heartbeat

문제:

- 현재 Local Agent heartbeat 기본 주기가 20초라, 네이버 계정/API Key 저장 직후 대시보드가 늦게 바뀝니다.
- 사용자가 그 사이 `실행기 연결`을 반복 클릭하면서 Windows 실행기/브라우저 세션 충돌 가능성이 커집니다.

해야 할 일:

- `local_agent/runtime.py` 또는 공통 Agent 경로에 "즉시 heartbeat 전송" helper를 추가하세요.
- 로컬 보안 설정 창에서 저장 성공 직후, 다음 poll 주기를 기다리지 말고 즉시 `/api/agent/heartbeat`를 호출하세요.
- `open_settings` command 처리 후에도 저장 성공이면 즉시 heartbeat를 보내세요.
- heartbeat payload에는 기존 `_collect_web_agent_readiness()` 결과를 그대로 사용하세요.
- 실패해도 설정 저장 자체를 실패로 되돌리지 말고, 로그에 `[웹앱 연결] 즉시 상태 전송 실패: ...` 형태로 남기세요.

검증 기준:

- 로컬 설정 저장 후 5초 이내 `/api/agent/status`의 readiness가 `naver_account.status=ready`, 선택 모델 key ready로 바뀌어야 합니다.
- 네이버/API Key 원문이 네트워크 payload, 로그, Syncthing 산출물에 남지 않아야 합니다.

### 2. Windows 실행기 중복 실행 방지

문제:

- Windows에서 웹앱의 `aimax://agent/connect`를 여러 번 누르면 새 실행기가 중복 실행될 수 있습니다.
- 중복 실행된 Agent가 같은 Chrome profile을 잡으면 기존 브라우저가 종료되거나 DevTools 연결이 끊겨 `invalid session`이 발생할 수 있습니다.

해야 할 일:

- Windows 실행기는 단일 인스턴스만 유지되도록 막으세요.
- 권장 구현:
  - Windows named mutex 또는 `APP_DATA_DIR` lock file을 사용합니다.
  - 두 번째 실행은 새 polling loop나 새 browser profile을 만들지 말고 조용히 종료하거나 기존 실행기가 살아있다는 로그만 남깁니다.
  - OS별 코드가 필요하면 `local_agent/runtime.py` 안에 크게 넣지 말고 작은 helper 함수로 분리하세요.
- 기존 실행 중인 작업이 있으면 새 `aimax://` 호출이 Chrome profile cleanup을 유발하면 안 됩니다.

검증 기준:

- Windows에서 `aimax://agent/connect`를 3회 연속 호출해도 AIMAX 프로세스가 1개만 유지되어야 합니다.
- 반복 호출 중 기존 Selenium/Chrome 세션이 끊기지 않아야 합니다.

### 3. 실패 키워드/실패 단계 result 기록

문제:

- 현재 글쓰기 작업은 성공한 글만 `result.posts`에 잘 남고, 실패한 키워드는 작업목록에서 충분히 보이지 않을 수 있습니다.

해야 할 일:

- `app.py`의 `_worker_write()`에서 키워드별 처리 실패 시에도 `post_results`에 실패 항목을 추가하세요.
- 최소 필드:

```json
{
  "type": "keyword",
  "source": "실패한 키워드",
  "title": "",
  "status": "failed",
  "stage": "editor_login|content_generation|title_input|body_input|publish|unknown",
  "error": "sanitized short error",
  "char_count": 0,
  "target_char_count": 1500
}
```

- 각 단계 앞에서 `current_stage`를 갱신하세요.
- AI 글 생성 실패와 네이버 에디터/발행 실패를 구분하세요.
- 예외 메시지는 secret redaction을 거친 뒤 300~500자 정도로 자르세요.

주의:

- 서버가 아직 `stage/error`를 sanitize하지 않으면 대시보드에는 안 보일 수 있습니다. 그래도 Local Agent result에는 먼저 넣어야 합니다.
- Mac 담당자가 서버/webapp sanitize 및 표시를 별도 반영합니다.

검증 기준:

- `scripts/headless_agent_polling_smoke.py`에 실패 키워드가 `result.posts[].status=failed`로 남는지 assertion을 추가하세요.
- 실패 job result의 `success`, `total`, `posts`, `error`가 일관되어야 합니다.

### 4. `invalid session / DevTools disconnected` 1회 복구

문제:

- 글쓰기 버튼 진입/에디터 입력 중 Chrome DevTools 연결이 끊기면 해당 작업이 바로 실패합니다.
- 사용자가 다시 실행하면 되는 경우가 있으므로, 같은 원고로 1회 복구할 수 있습니다.

해야 할 일:

- `_worker_write()` 키워드별 처리에서 Selenium session lost 오류를 감지하세요.
- 감지 문구 후보:
  - `invalid session`
  - `not connected to DevTools`
  - `disconnected`
  - `chrome not reachable`
  - `browser has closed the connection`
- 복구 방식:
  1. 이미 생성된 `content`, `title`, `content_list`는 재사용합니다.
  2. AI 글 생성 API를 다시 호출하지 않습니다.
  3. 기존 driver를 안전하게 quit 시도합니다.
  4. 새 driver 생성, 네이버 로그인, 글쓰기 화면 진입을 한 번만 재시도합니다.
  5. 재시도도 실패하면 해당 키워드를 failed post result로 기록합니다.

검증 기준:

- 테스트는 mock/fake exception으로 먼저 합니다. 실제 paid generation이나 실제 네이버 발행으로 검증하지 마세요.
- 로그에 `브라우저 세션 끊김 감지 — 같은 원고로 1회 재시도` 같은 문구가 남아야 합니다.

### 5. 볼드 입력 중복 핫픽스

문제:

- 실제 발행 글에서 볼드 처리 이후 키워드가 반복되는 현상이 보고됐습니다.
- 현재 SmartEditor 입력은 볼드 버튼을 직접 ON/OFF하면서 `ActionChains`로 글자를 입력합니다. SmartEditor 포커스/선택 상태가 꼬이면 중복 입력이 날 수 있습니다.

즉시 핫픽스 방향:

- 안정성이 우선입니다. 서식보다 본문 중복 방지가 더 중요합니다.
- `posting/editor.py`의 `_input_text_block()`에서 `bold` part를 당분간 일반 텍스트로 입력하도록 바꾸세요.
- 인용구 실패 fallback도 bold fallback 대신 일반 텍스트 fallback으로 바꾸세요.
- 가능하면 config/env flag를 두세요.
  - 예: `AIMAX_EDITOR_ENABLE_BOLD=0` 기본값.
  - 기본값은 안전하게 `0` 또는 false.
  - 나중에 SmartEditor 검증이 끝나면 켤 수 있게 합니다.

검증 기준:

- `**키워드** 일반문장`이 최종 입력될 때 키워드가 중복 입력되지 않아야 합니다.
- Markdown parser 자체는 `bold` part를 유지해도 되지만, editor 입력 단계에서 plain text로 처리하면 됩니다.

### 6. 예리 명칭 반영 범위 확인

Mac 담당자가 서버/webapp 문구 변경을 맡습니다. Windows 담당자는 빌드 산출물과 로컬 앱 이름에서 남아 있는 문구를 확인하세요.

확인/수정 후보:

- `split_version/build_split.py`
- `처음_읽어주세요.txt`
- Windows installer display name
- 앱 이름/바로가기 이름
- 사용자에게 보이는 `소통글쓰기` 문구

목표 문구:

```text
예리씨-블로그글쓰기
예리 블로그 글쓰기
블로그 글쓰기 직원
```

단, 파일명 변경은 설치/업데이트 경로에 영향이 있으므로 변경한 경우 반드시 보고하세요.

## Windows 빌드 목표

이번 산출물은 가능하면 `v1.0.2` 또는 `user-feedback-hotfix-20260507`로 식별되게 하세요.

필수 산출물:

- 통합 Windows 설치 파일
- 예리 Windows 설치 파일
- 현주 Windows 설치 파일
- SHA-256 파일
- 완료 보고서

## 권장 검증 순서

1. 새 작업 폴더에서 최신 source를 풉니다. Syncthing 공유 폴더 안에서 직접 빌드하지 마세요.
2. `python -m py_compile app.py local_agent/runtime.py posting/editor.py web_agent/client.py scripts/headless_agent_polling_smoke.py`
3. `python scripts\headless_agent_polling_smoke.py`
4. 실패 키워드 result assertion 추가 후 smoke 재실행
5. 즉시 heartbeat 검증 smoke 추가 또는 수동 fake API로 확인
6. `aimax://agent/connect` 반복 호출 후 프로세스 1개 유지 확인
7. Windows EXE/installer 빌드
8. 설치 후 첫 실행:
   - 기존 전체 Tkinter UI가 뜨지 않아야 함
   - `AIMAX 웹앱 연결` 창 또는 저장된 세션 기반 headless mode가 동작해야 함
   - `AIMAX 로컬 보안 설정` 저장 후 readiness가 빠르게 바뀌어야 함
9. 실제 paid API/네이버 발행 테스트는 사용자 승인 후 1건만 진행

## 완료 보고에 반드시 포함

- 사용한 source 폴더 경로
- 수정 파일 목록
- 각 수정의 의도
- `py_compile` 결과
- smoke test 결과
- 단일 인스턴스 검증 결과
- 즉시 heartbeat 검증 결과
- 실패 키워드 result 검증 결과
- bold hotfix 적용 여부
- `invalid session` 복구 구현 여부와 검증 방식
- 서버/webapp 파일 수정 여부
- EXE/installer 3종 파일명, 크기, SHA-256
- 실제 paid API/네이버 테스트를 했다면 사용자 승인 여부, job id, 모델, 글자수, 이미지 수, 결과
- Syncthing으로 되돌려 보낸 폴더 경로

## Mac 담당자와의 경계

Windows 담당자가 해야 할 일:

- Windows Local Agent 안정화
- 공통 Python 코드 중 Windows 실행기 빌드에 필요한 수정
- Windows 단일 인스턴스 방어
- Windows EXE/installer 재빌드
- Windows 환경 smoke/manual 검증

Mac 담당자가 해야 할 일:

- Oracle 서버/webapp 대시보드 자동 갱신, 버튼 잠금, 작업목록 표시 개선
- 서버 `sanitizeJobResult`가 failed post의 `stage/error`를 보존하도록 수정
- 운영 Oracle 배포
- macOS DMG 재빌드가 필요한 경우 별도 진행

서버/webapp 변경이 필요하다고 판단되면 Windows 쪽에서 직접 운영 반영하지 말고 완료 보고에 "Mac 담당자 필요"로 적으세요.

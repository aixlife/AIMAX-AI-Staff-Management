# AIMAX R3-F 예리 최소 유료 E2E — Mac 결과

작성: 2026-05-25

## OS Lane

- Lane: Mac
- Windows lane: 보류, 이번 실행에 사용하지 않음
- Runner used: `/Applications/AIMAX.app` `v1.0.11` rebuilt after NID sync fix
- AIMAX account: `demo@aimax.ai.kr`
- Naver account: test account, redacted

## Job

- Job id: `d0abdaa5-0e13-41cf-a6b8-69ef613158dc`
- Target platform: `macos`
- Mode: `save` / 임시저장
- Payload: `word_count=300`, `image_count=1`, `ai_model=gemini-2.5-flash`
- Server artifact id: `d0abdaa5-0e13-41cf-a6b8-69ef613158dc`

## Final Result

Verdict: `pass`

재빌드/재설치 후 기존 job artifact를 재사용해 Mac 유료 E2E를 완료했다.

- Retry response: `reused_artifact=true`
- Final server status: `done`
- Mode: `save` / 임시저장
- Published: no
- Scheduled: no
- Artifact reused: yes
- Second paid text generation: no
- Naver fresh login fallback: executed
- Smart Editor opened: yes
- Title inserted: yes
- Body inserted: yes
- Image attempted: 1
- Image generated: 1
- Image inserted: 1
- Image provider: OpenAI
- Draft saved: yes
- Final estimated cost: 63 KRW
  - text: 1 KRW
  - image: 62 KRW

## Final Server Job Snapshot

```text
status: done
failed_stage: null
mode: save
retry_count: 1
images.attempted: 1
images.generated: 1
images.inserted: 1
image_provider_counts.openai: 1
cost.total_won: 63
```

## Passing Runtime Evidence

```text
NID 세션 미인식 — blog.naver.com 동기화 실패 (재로그인 필요)
PC 블로그 동기화 실패 — 재로그인 진행...
네이버 로그인 시작 (JS 주입 방식)...
네이버 로그인 완료
마크다운 파싱 완료: 제목='AIMAX 예리: 이미지 위치 테스트', 3개 블록
에디터 컨텍스트 준비 완료 (mainFrame)
글쓰기 화면 준비 완료
제목 입력: AIMAX 예리: 이미지 위치 테스트
OpenAI 이미지 생성 완료
이미지 업로드 성공 (mainFrame file input)
이미지 삽입 완료
임시 저장 완료
```

## First Attempt Result

서버 유료 글 생성은 성공했다.

- Status after generation: `ready_for_publish`
- Artifact text model: `gemini-2.5-flash`
- Artifact visible char count: 269
- Recorded text cost: 1 KRW
- Second paid text generation: no

Mac 실행기도 job을 정상 claim했다.

- Job moved to `running`
- Browser launched
- Naver saved session restored
- Artifact markdown parsed
- Title detected: `AIMAX 예리: 이미지 위치 테스트`

First-attempt blocker:

- Stage: `smart_editor_open`
- Error: 글쓰기 NID 재로그인 후에도 로그인 페이지에 머묾
- URL: `https://nid.naver.com/nidlogin.login?svctype=262144&url=https://blog.naver.com`
- Local diagnostic HTML: `/Users/aixlife/Library/Application Support/AIMAX/debug/editor_nid_redirect_after_retry.html`

## Safety

- No Apify
- No publish
- No schedule
- No customer credentials
- No duplicate paid text generation
- One approved paid image generation was used for placement verification
- Draft save only

## First Attempt Server Job Snapshot

```text
status: failed
failed_stage: smart_editor_open
mode: save
images.attempted: 0
images.generated: 0
images.inserted: 0
cost.total_won: 1
```

## Root Cause

파일: `browser/session_manager.py` — `sync_pc_blog_login()` line 155

```python
# 수정 전 (버그)
if "blog.naver.com" in current:

# 수정 후
current_host = urlparse(current).hostname or ""
if current_host == "blog.naver.com" or current_host.endswith(".blog.naver.com"):
```

`https://nid.naver.com/nidlogin.login?svctype=262144&url=https://blog.naver.com` URL에서
쿼리파라미터 `url=https://blog.naver.com` 이 `"blog.naver.com" in current` 을 True로 만들어
세션 만료 상태에서도 동기화 "성공" 판정 → `login()` 의 fresh login fallback 차단 → 무한 루프.

부수 버그: `auth/naver_login.py` `login_on_current_nid_page()` 3차 경로에서
`sync_pc_blog_login()` True 반환 후 URL 재확인 없이 `return True` — 방어 체크 추가.

## Fixes Applied

- `browser/session_manager.py`: `sync_pc_blog_login()` URL 체크를 `urlparse().hostname` 기반으로 변경
- `auth/naver_login.py`: 3차 경로에 `"nidlogin.login" in current_url` 방어 체크 추가
- Codex follow-up: NID host check도 `current_host` 기반으로 통일

## Rebuild / Install

- Build command: `venv/bin/python build.py`
- Rebuilt artifact: `dist/AIMAX.app`
- Installed artifact: `/Applications/AIMAX.app`
- Installed version: `v1.0.11`
- Diagnostics probe: passed
- Codesign verify: passed
- DMG verify: passed

## Retry

- Job retry API returned `reused_artifact=true`
- Job returned to `ready_for_publish`
- Mac runner claimed the same job id
- No additional paid text generation occurred

## Next Gate

Mac R3-F minimal paid E2E is complete. Next safe gates:

1. Deploy the rebuilt macOS installer/DMG if customers need this NID fix.
2. Prepare a Windows-specific handoff only if Windows source needs the same NID hostname fix.
3. Keep future paid E2E tests short, draft-save only, and one image maximum unless explicitly expanded.

Windows lane can be tested separately only with an explicit Windows target/job and its own result doc.

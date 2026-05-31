# Windows Codex Copy-Paste Prompt - R3-F NID Login Fix

너는 Windows 환경의 AIMAX 실행기 담당 Codex다. 아래 작업을 Windows 로컬 작업 폴더에서 수행해줘.

## 먼저 읽을 문서

Syncthing 공유 폴더에서 다음 문서를 먼저 읽어:

```text
WINDOWS_HANDOFF_20260525_r3f_nid_login_fix.md
```

그리고 포함된 소스 파일을 확인해:

```text
source-files/browser/session_manager.py
source-files/auth/naver_login.py
```

중요: Syncthing 공유 폴더 안에서 직접 빌드하지 말고, 반드시 로컬 Windows 작업 폴더로 복사해서 작업해. 비밀번호/토큰/쿠키/세션 파일은 절대 공유 폴더에 넣지 마.

## 작업 목표

Mac에서 확정된 Naver NID 로그인 루프 버그를 Windows 실행기에도 반영해.

버그 원인:

```text
sync_pc_blog_login()이 "blog.naver.com" in current_url 로 성공 여부를 판단해서,
nid.naver.com/nidlogin.login?...url=https://blog.naver.com 을 blog 도착으로 오탐했다.
그 결과 세션이 만료돼도 성공 처리되어 fresh login fallback이 막혔다.
```

필수 수정:

1. `browser/session_manager.py`
   - `from urllib.parse import urlparse` 확인
   - `current_host = urlparse(current).hostname or ""`
   - blog 성공 판정은 host가 `blog.naver.com` 또는 `.blog.naver.com`일 때만
   - NID 실패 판정도 host가 `nid.naver.com` 또는 `.nid.naver.com`일 때만

2. `auth/naver_login.py`
   - `login_on_current_nid_page()`의 3차 sync 경로에서 `sync_pc_blog_login()`이 true를 반환해도 현재 URL이 아직 `nidlogin.login`이면 성공 return 금지
   - 이 경우 경고 로그 후 기존 실패 처리/fresh-login 흐름으로 가게 유지

## 검증

최소 검증:

```powershell
python -m py_compile browser\session_manager.py auth\naver_login.py
```

그리고 no-paid URL 판정 검증:

```text
https://nid.naver.com/nidlogin.login?svctype=262144&url=https://blog.naver.com
```

이 URL의 hostname은 `nid.naver.com`이어야 하고, `sync_pc_blog_login()` 성공으로 판정되면 안 된다.

빌드까지 진행할 경우:

- 현재 Windows 배포 버전보다 업데이트가 필요한지 판단해. 사용자가 자동 업데이트로 받아야 한다면 Windows 패키지 버전을 다음 버전으로 올리는 것을 권장한다.
- Windows 실행기 빌드/설치 후 `--diagnostics-probe` 실행.
- no-paid 검증에서는 job 생성/claim/execution 금지.

## 금지

- 유료 AI 호출 금지
- Apify 금지
- Naver 글 발행/예약 금지
- 고객 계정/고객 자격증명 사용 금지
- 공유 폴더에 secrets/passphrase/token/cookie 저장 금지

## 완료 보고

완료 후 Syncthing 공유 폴더에 아래 파일을 반환해:

```text
WINDOWS_RESULT_20260525_r3f_nid_login_fix.md
aimax_r3f_windows_nid_login_fix_diag.json
```

보고서에는 반드시 포함:

- 적용/확인한 파일
- 문법 검사 결과
- NID URL 오탐 방지 검증 결과
- 빌드/버전 판단
- diagnostics 결과
- 실제 Windows draft-save E2E가 추가로 필요한지 여부

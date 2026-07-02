당신은 AIMAX Windows 쪽 개발자입니다.

Mac/Oracle 쪽 AIMAX 최신 소스를 GitHub private repo로 정리해 푸시했습니다.

먼저 아래 handoff를 읽고 진행하세요.

```text
20_Deploy-To-Windows/2026-06-01-github-source-access/WINDOWS_HANDOFF_20260601_github_source_access.md
```

GitHub repo:

```text
https://github.com/aixlife/AIMAX-AI-Staff-Management
```

중요:

- 이 repo는 private입니다. 접근이 안 되면 Minsoo에게 GitHub collaborator/access 권한을 요청하세요.
- Syncthing 폴더 안에서 clone/build/test하지 마세요.
- Windows 로컬 작업 폴더에 clone하세요.
- GitHub는 최신 소스 확인용, Syncthing은 작업 지시/결과 보고/명시 요청된 산출물 전달용입니다.
- `.env`, API key, 쿠키, 세션 토큰, admin 비밀번호, Naver ID/PW, auth header, signed URL, passphrase를 GitHub나 Syncthing에 절대 남기지 마세요.
- 유료 AI/API 생성, Apify, Naver 발행/예약은 명시 승인 없이 실행하지 마세요.

권장 시작 명령:

```powershell
cd $env:USERPROFILE\Desktop
git clone https://github.com/aixlife/AIMAX-AI-Staff-Management.git AIMAX-AI-Staff-Management
cd AIMAX-AI-Staff-Management
git status
```

처음 확인할 파일:

```text
README.md
AGENTS.md
docs/maintenance_reports/aimax_github_source_publish_20260601.md
```

오류 보고 직접 확인 루틴도 필요하면 다음 문서를 함께 읽으세요.

```text
20_Deploy-To-Windows/2026-06-01-windows-error-report-direct-check/WINDOWS_AI_LAUNCH_PROMPT_20260601_safe_error_report_inspection.md
```

결과 보고:

GitHub 접근 가능 여부와 clone 위치, 현재 commit, 문제가 있으면 blocker를 아래 파일로 Syncthing에 남겨주세요.

```text
WINDOWS_AI_RESULT_20260601_github_source_access.md
```

보고에는 비밀값을 절대 포함하지 마세요.

# AIMAX Oracle Deployment Runbook

## 배포 구조

현재 AIMAX 웹앱은 Vercel이 아니라 Oracle 서버의 Node 서비스로 운영한다.

```text
Mac source
/Users/aixlife/Projects/AIMAX-AI-Staff-Management
  |
  | scripts/deploy_oracle.sh
  v
Oracle server: oracle-server
/home/ubuntu/aimax-reports-api
/home/ubuntu/aimax-downloads
  |
  | systemd user service
  v
aimax-reports-api.service
  |
  v
https://api.aimax.ai.kr/app
```

## 표준 배포 명령

배포 전에 항상 dry-run을 먼저 실행한다.

```bash
scripts/deploy_oracle.sh web --dry-run
scripts/deploy_oracle.sh installers --dry-run
scripts/deploy_oracle.sh all --dry-run
```

실제 배포:

```bash
scripts/deploy_oracle.sh web
scripts/deploy_oracle.sh installers
scripts/deploy_oracle.sh all
```

## 모드

- `web`: `server.js`, `static/app.html`, `static/admin.html` 배포
- `installers`: macOS/Windows 설치 파일 6종만 배포
- `all`: 서버/웹앱/관리자 페이지와 설치 파일 전체 배포

## Caddy 공개 라우트

`api.aimax.ai.kr`의 Caddy 설정은 아래 경로를 `127.0.0.1:18988`의
`aimax-reports-api.service`로 프록시해야 한다.

- `/api/*`
- `/app*`
- `/admin*`
- `/assets/*`
- `/health`
- `/`

## 표준 로컬 설치 파일 위치

```text
dist/upload_installers/aimax-bundle-macos.dmg
dist/upload_installers/aimax-yeri-macos.dmg
dist/upload_installers/aimax-hyunju-macos.dmg
dist/upload_installers/aimax-bundle-windows.exe
dist/upload_installers/aimax-yeri-windows.exe
dist/upload_installers/aimax-hyunju-windows.exe
```

Windows AI가 Syncthing으로 반환한 최종 EXE는 배포 전에 위 폴더로 맞춰둔다.

## 스크립트가 자동으로 하는 일

- 배포 대상 파일 존재 확인
- 로컬 SHA-256 계산
- 서버 백업 폴더 생성
- 서버 임시 폴더 업로드
- 기존 운영 파일 백업
- 운영 파일 교체
- `aimax-reports-api.service` 재시작
- 서버 SHA-256 출력
- 서비스 상태 출력
- 로컬 배포 리포트 생성

리포트 위치:

```text
docs/deployments/oracle-deploy-YYYYMMDD-HHMMSS.md
```

서버 백업 위치:

```text
/home/ubuntu/aimax-backups/YYYYMMDD-HHMMSS
```

## 운영 확인

배포 후 확인:

```bash
curl -sS -L https://api.aimax.ai.kr/app | rg "실행기 연결|aimax://agent/connect"
curl -sS -L https://api.aimax.ai.kr/admin | rg "AIMAX Admin|계정 등록|오류 보고"
curl -sS -i https://api.aimax.ai.kr/api/admin/users | rg "401|unauthorized"
```

서비스 상태:

```bash
ssh -o BatchMode=yes oracle-server 'systemctl --user status aimax-reports-api.service --no-pager | sed -n "1,12p"'
```

다운로드 옵션은 로그인 세션이 필요하므로 로컬 저장 세션으로 확인한다.

```bash
./venv/bin/python -c "import json; from web_agent.client import AimaxWebAgentClient, load_session_token, load_state; s=load_state(); c=AimaxWebAgentClient(base_url=s.get('base_url'), session_token=load_session_token()); print(json.dumps(c._request('GET','/api/downloads/options'), ensure_ascii=False, indent=2))"
```

## 롤백

1. 가장 최근 백업 폴더를 확인한다.
2. 필요한 파일만 원래 위치로 복사한다.
3. 웹앱을 롤백했다면 서비스를 재시작한다.

예:

```bash
ssh -o BatchMode=yes oracle-server 'cp /home/ubuntu/aimax-backups/<timestamp>/app.html /home/ubuntu/aimax-reports-api/static/app.html && systemctl --user restart aimax-reports-api.service'
```

설치 파일 롤백은 `/home/ubuntu/aimax-downloads`의 같은 파일명으로 되돌린다.

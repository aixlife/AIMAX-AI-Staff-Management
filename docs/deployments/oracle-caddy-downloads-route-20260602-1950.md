# Oracle Caddy Downloads Route - 2026-06-02 19:50 KST

## Change

- Added `handle /downloads/* { reverse_proxy 127.0.0.1:18988 }` to `/etc/caddy/Caddyfile`.
- Backup: `/etc/caddy/Caddyfile.bak-20260602-1947-downloads`.
- Reason: public external staff EXE URLs under `https://api.aimax.ai.kr/downloads/...` were returning Caddy-level `404` even though `aimax-reports-api` had the files and route.

## Validation

- `sudo caddy validate --config /etc/caddy/Caddyfile` -> `Valid configuration`.
- `sudo systemctl reload caddy` completed.
- `GET /health` returned `ok=true`.

## Public Download Checks

- `https://api.aimax.ai.kr/downloads/Pencil-Setup-1.0.0.exe` -> `HTTP 200`, `content-length: 88022172`.
- `https://api.aimax.ai.kr/downloads/Pencil-portable.exe` -> `HTTP 200`, `content-length: 87794498`.
- `https://api.aimax.ai.kr/downloads/AIMAX-Office-Manager-Setup-0.1.4.exe` -> `HTTP 200`, `content-length: 161141736`.
- `https://api.aimax.ai.kr/downloads/AIMAX-Office-Manager-portable.exe` -> `HTTP 200`, `content-length: 160864137`.

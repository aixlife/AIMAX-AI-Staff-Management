# Oracle Deploy - Jieun v0.1.5 Mosaic

## Summary

지은 `AI 오피스 지원` Windows 앱 `v0.1.5`를 운영 배포했다. 이번 버전은 캡처 후 이미지 편집 창에서 선택 영역을 모자이크 처리하고 편집본을 저장할 수 있게 한다.

## Source And Build

- Source repo: `aixlife/aimax-viseo`
- Issue: https://github.com/aixlife/aimax-viseo/issues/1
- PR: https://github.com/aixlife/aimax-viseo/pull/2
- PR merge SHA: `1d44471e1b5b70be21c070a4b28ee982b0bca270`
- Windows returned folder: `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-06-03-jieun-mosaic-v015-windows-build`

## Artifacts

| File | Size | SHA256 |
|---|---:|---|
| `AIMAX-Office-Manager-Setup-0.1.5.exe` | `161146954` | `e13a7ef23ccfe220651fb50beab24c78c221b13696c76c3787d7fd40a7c7070a` |
| `AIMAX-Office-Manager-portable.exe` | `160869288` | `43fcc04e8526327af81e64284fd67a0d8b441e339146b76e66c6b26e5b34f7d8` |

## Gate

- Windows AI report: build passed, unpacked app smoke passed for capture editor and mosaic drag.
- Owner/user installed Windows test: passed, no issue reported, approved deployment.
- Mac local SHA recheck: matched Windows `SHA256SUMS.txt`.
- Local checks:
  - `node --check oracle/aimax-reports-api/server.js`
  - `node scripts/smoke_worker_catalog_contract.mjs`
  - app/admin inline script parse

## Deployment

- Web catalog deploy: `docs/deployments/oracle-deploy-20260603-231508.md`
- External staff EXE deploy: `docs/deployments/oracle-deploy-20260603-231646.md`
- Remote backup:
  - `/home/ubuntu/aimax-backups/20260603-231508`
  - `/home/ubuntu/aimax-backups/20260603-231646`

## Production Verification

- `https://api.aimax.ai.kr/health` returned `ok=true`.
- `https://api.aimax.ai.kr/downloads/AIMAX-Office-Manager-Setup-0.1.5.exe` returned `HTTP 200`, content length `161146954`.
- `https://api.aimax.ai.kr/downloads/AIMAX-Office-Manager-portable.exe` returned `HTTP 200`, content length `160869288`.
- `/api/workers` returns Jieun:
  - `version=0.1.5`
  - `setup_download_url=https://api.aimax.ai.kr/downloads/AIMAX-Office-Manager-Setup-0.1.5.exe`
  - capability `캡처 이미지 모자이크`

## Result

Deployment completed.

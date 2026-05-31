# Oracle Deploy 20260521 macOS v1.0.5 Login UX Fallback

Date: 2026-05-21 KST

## Summary

Deployed a macOS bundle update for the local launcher login UX and safe-storage fallback.

- macOS bundle: `dist/upload_installers/aimax-bundle-macos.dmg`
- Remote: `/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg`
- SHA256: `9c4f14ff02826746f61f13b3d963c66d501dc60c37bc16c7464cdd00f3fa5c82`
- Runtime: `v1.0.5` / `AIMAX v1.0.5`
- Backup: `/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg.v1.0.2-visible-v105.backup-20260521-login-ux`

## Changes

- `invalid_credentials` is mapped to Korean user guidance.
- Login success is no longer turned into failure only because local safe-storage session save fails.
- GUI and headless launcher connection paths use the same friendly login error guidance.
- Existing editor `image_provider` contract remains covered.

## Verification

- `python -m py_compile web_agent/client.py local_agent/runtime.py app.py split_version/app.py posting/editor.py scripts/verify_editor_image_provider_contract.py`
- `LOGIN_FRIENDLY_ERROR_MESSAGES_OK`
- `LOGIN_UX_STATIC_GUARDS_OK`
- `TOKEN_SAVE_FALLBACK_SIMULATION_OK`
- `EDITOR_IMAGE_PROVIDER_CONTRACT_OK`
- `hdiutil verify dist/AIMAX-macos.dmg`: valid
- `/Applications/AIMAX.app --diagnostics-probe`: `version=v1.0.5`, `ai_text_import_smoke.ok=true`

## Server Config

```text
AIMAX_MACOS_LATEST_AGENT_VERSION=v1.0.5
AIMAX_MACOS_MIN_AGENT_VERSION=v1.0.5
AIMAX_MACOS_AGENT_RELEASE_NOTES="macOS 실행기 연결 로그인 안내와 안전 저장소 세션 저장 안정성을 보강한 업데이트입니다."
```

External checks:

- `platform=macos&current=v1.0.2` -> `update_required=true`
- `platform=macos&current=v1.0.5` -> `update_required=false`
- `platform=windows&current=v1.0.12` -> unchanged, `update_required=false`

## Notes

- App bundle uses ad-hoc signing; `codesign --verify --deep --strict` passed.
- `spctl --assess` returned a Code Signing subsystem internal error, so unsigned/ad-hoc SmartScreen/Gatekeeper-style warnings remain a residual risk.
- Account password reset/setup link generation for `demo@aimax.ai.kr` was not performed because it requires explicit user approval to change account access state.


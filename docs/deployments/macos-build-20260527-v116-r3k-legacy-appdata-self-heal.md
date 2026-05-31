# AIMAX macOS Build - v1.0.16 R3-K Legacy AppData Self-Heal

Date: 2026-05-27 KST

## Status

Mac `v1.0.16` R3-K candidate is built and staged locally.

Live deployment was not performed.

## Scope

R3-K adds conservative local-state diagnostics and repair support:

```text
detect legacy NaverBlog*/naverblog* local-state folders
detect stale AIMAX local-agent request files
include system.local_state in diagnostics/error reports
provide hidden --repair-local-state CLI
quarantine by move/rename only
preserve lock file as diagnostic-only
```

## Build

Command:

```text
venv/bin/python build.py
```

Output:

```text
dist/AIMAX.app
dist/AIMAX-macos.dmg
dist/upload_installers/aimax-bundle-macos.dmg
```

Previous staged Mac DMG archived:

```text
dist/upload_installers/archive-macos-20260527-pre-v116-r3k-legacy-appdata-self-heal/aimax-bundle-macos.dmg
sha256: 900af3671bdc322c29297fca3f1294806bf0ae0cefb156e54c7682dcf3415878
```

## Verification

```text
python -m py_compile aimax_compliance.py split_version/aimax_compliance.py app.py split_version/app.py diagnostics/system_info.py local_agent/state_repair.py scripts/smoke_legacy_appdata_self_heal.py
PASS

venv/bin/python scripts/smoke_legacy_appdata_self_heal.py
R3K_LEGACY_APPDATA_SELF_HEAL_OK

venv/bin/python scripts/smoke_local_settings_preserve_secrets.py
LOCAL_SETTINGS_PRESERVE_SECRETS_OK

venv/bin/python app.py --diagnostics-probe /private/tmp/aimax_r3k_diag_probe.json
version: v1.0.16
ai_text_import_smoke.ok: true
system.local_state present: true

venv/bin/python app.py --repair-local-state /private/tmp/aimax_r3k_repair_dry_run.json --repair-local-state-dry-run
ok: true
dry_run: true
```

Frozen verification:

```text
codesign --verify --deep --strict dist/AIMAX.app
PASS

hdiutil verify dist/AIMAX-macos.dmg
checksum valid

dist/AIMAX.app/Contents/MacOS/AIMAX --diagnostics-probe /private/tmp/aimax_r3k_v116_frozen_diag.json
version: v1.0.16
frozen runtime: true
ai_text_import_smoke.ok: true
system.local_state present: true
repair_strategy: quarantine_only_no_delete

dist/AIMAX.app/Contents/MacOS/AIMAX --repair-local-state /private/tmp/aimax_r3k_v116_frozen_repair_dry_run.json --repair-local-state-dry-run
ok: true
dry_run: true
errors: []
```

## SHA256

```text
d44263e506baa50cd02df3aa53c67cccfd7d39438358724161f01c408802f1ba  dist/AIMAX-macos.dmg
d44263e506baa50cd02df3aa53c67cccfd7d39438358724161f01c408802f1ba  dist/upload_installers/aimax-bundle-macos.dmg
```

## Safety

```text
No paid AI call.
No Apify call.
No Naver publish/schedule/edit/save mutation.
No customer credentials.
No live deployment.
Mac repair verification used dry-run only; no real local folders were moved.
```

## Windows Handoff

Sent to:

```text
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-27-r3k-legacy-appdata-self-heal
```

Expected Windows return files:

```text
WINDOWS_RESULT_20260527_r3k_legacy_appdata_self_heal.md
aimax_r3k_v126_legacy_appdata_self_heal_diag.json
aimax-bundle-windows.exe
NEXT_TRIGGER_20260527_r3k_legacy_appdata_self_heal.json
```

## Next Gate

Wait for Windows `v1.0.26` R3-K pass evidence. Do not deploy Mac v1.0.16 or
Windows v1.0.26 live until Windows returns pass and actual-test/deploy-ready
checklist is updated.

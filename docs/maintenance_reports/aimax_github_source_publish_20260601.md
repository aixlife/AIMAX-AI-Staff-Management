# AIMAX GitHub Source Publish - 2026-06-01

## Objective

Prepare the AIMAX Mac-side source tree for a private GitHub repository so the Windows developer can inspect current source without relying only on Syncthing ZIP/source bundles.

## Include

- Runtime/source code: `app.py`, `local_agent/`, `oracle/`, `content/`, `posting/`, `browser/`, `engagement/`, `auth/`, `bulk/`, `scraper/`, `utils/`, `web_agent/`, `split_version/` source files.
- Build configuration: maintained root PyInstaller specs such as `AIMAX.spec` and `NaverBlogAuto.spec`.
- Operations scripts: `scripts/`, `deploy/`, `launchd/`, `.github/`.
- Project context: `AGENTS.md`, `memory/`, `docs/`, `handoffs/` Markdown-oriented handoffs.
- Static assets required by app/UI.

## Exclude

- Secrets and local credentials: `.env`, passphrases, token/cookie/credential files, encrypted local handoff secret files.
- Generated artifacts: `dist/`, `build/`, `release-artifacts/`, `split_version/dist/`, `split_version/build/`.
- Virtualenv and caches: `venv/`, `__pycache__/`, `.DS_Store`.
- Heavy/duplicated transfer bundles: `*.zip`, `*.dmg`, `*.exe`, `*.pkg`, handoff `source-files/`, `source-tree/`, docs `source-bundle/`.
- Local run outputs: `council-runs/`, `songi-local-runs/`.

## Safety Notes

- The initial secret scan was filename-only for likely secret patterns plus `.gitignore` hardening. Matches remaining in tracked source are code references to `api_key`, `token`, `password`, or `secret` handling, not files intentionally carrying live credentials.
- GitHub repository must be private.
- Windows developer should use GitHub for current source and Syncthing for task-specific handoffs/results.

## Local Archive

Large generated artifacts were moved out of the source directory, not deleted:

```text
/Users/aixlife/Projects/AIMAX-AI-Staff-Management-archive/2026-06-01-pre-github-cleanup/
```

Archived items:

- `dist/`
- `build/`
- `release-artifacts/`
- `venv/`
- `split_version/dist/`
- `split_version/build/`

Restore only when an installer rebuild/deploy task explicitly needs those previous artifacts.

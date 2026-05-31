# Windows Handoff - GitHub Source Access

Date: 2026-06-01 KST

## Purpose

Give the Windows developer direct access to the current Mac/Oracle AIMAX source through a private GitHub repository.

## Repository

```text
https://github.com/aixlife/AIMAX-AI-Staff-Management
```

Visibility:

```text
PRIVATE
```

Default branch:

```text
main
```

Initial commit:

```text
85561de Initial AIMAX source publish
```

## What GitHub Is For

- Inspect current Mac/Oracle source.
- Compare Windows-side source with the current canonical source.
- Create Windows patches against current source.
- Reference deployment/test documentation.

## What Syncthing Is For

- Task-specific handoff instructions.
- Windows result reports.
- Built Windows artifacts or SHA evidence when explicitly requested.
- Sanitized logs/evidence only.

## Safety Boundary

Do not put secrets into GitHub or Syncthing:

- `.env`
- API keys
- admin passwords
- cookies/session tokens
- Naver ID/password
- auth headers
- signed URLs
- passphrases

The source repo intentionally excludes generated artifacts and local state:

- `dist/`
- `build/`
- `release-artifacts/`
- `venv/`
- `split_version/dist/`
- `split_version/build/`
- source ZIP/source-files transfer bundles

Mac-side archive location for old generated artifacts:

```text
/Users/aixlife/Projects/AIMAX-AI-Staff-Management-archive/2026-06-01-pre-github-cleanup/
```

Windows should not need that archive unless Minsoo/Mac explicitly sends a required artifact through Syncthing.

## Expected Windows Workflow

1. Get GitHub access from Minsoo if the private repo is not visible.
2. Clone the repo into a normal local Windows work folder, not inside Syncthing.
3. Read `README.md`, `AGENTS.md`, and relevant handoff docs.
4. Use GitHub source as the canonical reference.
5. Do Windows builds/tests in a separate local work folder.
6. Return concise result reports and artifacts through Syncthing.

Do not build directly inside the Syncthing shared folder.

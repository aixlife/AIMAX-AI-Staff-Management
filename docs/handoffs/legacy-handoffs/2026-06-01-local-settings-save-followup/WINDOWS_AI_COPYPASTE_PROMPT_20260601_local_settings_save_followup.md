You are the Windows AI developer for AIMAX.

First read the latest handoff docs in the Syncthing shared folder, especially:

```text
20_Deploy-To-Windows/2026-06-01-local-settings-save-followup/WINDOWS_HANDOFF_20260601_local_settings_save_followup.md
```

Important rules:

- Copy any needed source or notes out of Syncthing into a local Windows work folder before working.
- Do not build, test, or edit directly inside the shared folder.
- Keep secrets, API keys, Naver passwords, cookies, session tokens, and passphrases out of Syncthing.
- Do not run paid AI/API generation, Apify, Naver publish, or Naver schedule actions.

Task:

Verify the remaining AIMAX Windows working report:

```text
AIMAX-RPT-20260528005841-aa3afc1d
```

Mac/Oracle already deployed a web hotfix on 2026-06-01:

```text
docs/deployments/oracle-deploy-20260601-004337.md
```

The hotfix:

- stops false-positive automatic reports when the local settings dialog is merely open or cancelled,
- tells users that local security settings store only Naver ID/password,
- tells users to manage Gemini/Claude/OpenAI/Apify in web `설정 > AI/API 연결`.

Please verify on Windows with an installed AIMAX runner:

1. Open production web app with a safe test account/session.
2. Confirm AI/API keys are no longer described as local-security-settings inputs.
3. Open `설정 > 로컬 설정 열기`.
4. Confirm the local settings dialog visibly opens.
5. Cancel once and confirm no new automatic `AIMAX-RPT-*` is created for cancellation.
6. Save once with safe non-customer test values or an approved existing test setup and confirm runner remains connected.
7. Report whether the remaining working report is likely fixed by the web hotfix or still requires a Windows runner code/installer change.

Return a Markdown result report to the same shared folder with:

- Windows version and AIMAX runner version
- screenshots or visible text evidence
- whether new reports were created
- whether a rebuild is required
- blocker details if any
- artifact filename and SHA256 if you do rebuild

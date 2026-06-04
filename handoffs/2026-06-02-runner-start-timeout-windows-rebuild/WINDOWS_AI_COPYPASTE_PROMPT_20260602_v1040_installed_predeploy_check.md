You are the Windows AI developer for AIMAX.

Read `WINDOWS_PREDEPLOY_INSTALLED_CHECK_20260602_v1040.md` in this Shared-Bridge folder first.

Goal: perform the required pre-deploy installed-runner check for `aimax-bundle-windows-v1.0.40.exe`.

Use this artifact:
- `aimax-bundle-windows-v1.0.40.exe`
- expected SHA256: `FE4E51537F8DF34876B896D8CDBB12FF64C91F60F7CCCE739F4D698B64214427`
- expected size: `35,677,124` bytes

Rules:
- Copy the installer out of Syncthing before running it.
- Do not build or run inside the shared folder.
- Do not use paid AI generation, Apify, YouTube Data API, Naver publish/schedule/edit/save, customer credentials, or duplicate paid retries.
- Keep secrets, passphrases, cookies, keychains, session files, `.env`, customer data, and signed URLs out of Syncthing.
- Do not upload to Oracle or change version API from Windows.

Required verification:
1. Verify installer SHA256/size.
2. Run/install `aimax-bundle-windows-v1.0.40.exe`.
3. Launch/connect the installed AIMAX runner.
4. Confirm installed runner version is `v1.0.40`.
5. Connect to production web with the approved test account/session.
6. Confirm the web UI sees Windows runner connected and version `v1.0.40`.
7. If a safe no-paid/fake/local job path is available, confirm stages include `claimed -> queued_to_ui -> worker_thread_started -> worker_running`.
8. If no installed fake/local job path is available, say that clearly and provide installed version + web connected/version evidence.

Return `WINDOWS_PREDEPLOY_RESULT_20260602_v1040_installed_runner.md` to this folder with screenshots/visible text evidence, command output summaries, and blockers if any.

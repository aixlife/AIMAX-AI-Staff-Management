You are the Windows AI developer for AIMAX.

Read `WINDOWS_HANDOFF_20260602_v1040_postdeploy_verify.md` first.

Goal: verify the production Oracle rollout of Windows runner `v1.0.40`.

Required checks:

1. Check `https://api.aimax.ai.kr/api/version?current=v1.0.39&platform=windows`.
   - Expect latest/min `v1.0.40`, `update_required=true`.
2. Check `https://api.aimax.ai.kr/api/version?current=v1.0.40&platform=windows`.
   - Expect `update_required=false`.
3. In the production web UI, confirm the Windows update/download flow offers the v1.0.40 bundle.
4. Download the production Windows bundle if the UI exposes it and verify SHA256:
   - `FE4E51537F8DF34876B896D8CDBB12FF64C91F60F7CCCE739F4D698B64214427`
5. Launch/connect the installed Windows runner.
6. Confirm the production web UI or API sees Windows runner connected at version `v1.0.40`.
7. If a safe no-paid/fake/local job path exists, confirm stages include `claimed -> queued_to_ui -> worker_thread_started -> worker_running`.
8. If no installed fake/local job path exists, report that clearly.

Do not run paid AI generation, Apify, YouTube Data API, Naver publish/schedule/edit/save, customer credentials, or duplicate paid retries. Keep secrets/cookies/keychains/session files/.env/signed URLs out of Syncthing.

Return `WINDOWS_RESULT_20260602_v1040_postdeploy_verify.md` to this Shared-Bridge folder with evidence and blockers.

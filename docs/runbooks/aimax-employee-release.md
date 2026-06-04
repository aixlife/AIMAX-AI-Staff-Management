# AIMAX Employee Release Runbook

Use this when adding or changing an AIMAX AI employee or employee-facing workflow.

## Sequence

1. Intake
   - Confirm employee name, role, core job, pricing/access policy, target platform, and whether the employee is web-first, local-agent-required, hybrid, or external-download.
   - Ask/check for display assets: profile image, avatar, download/release links, and user-facing description. If profile image is missing, use a placeholder only with an explicit TODO and mention it in the handoff/final summary.
   - Do not treat dashboard/marketing videos or one-off visual experiments as required employee launch assets unless the user asks.

2. Worker Catalog
   - Add/update the worker contract in the server catalog.
   - Expose required public fields through `/api/workers`: name, role, staff code, execution mode, access policy, platform support, images, download links, version, and capabilities.
   - Add or update the worker catalog smoke test for the new employee.

3. User App
   - Add/update the employee card, detail view, status text, action button, platform-specific guidance, and job switch behavior.
   - Download-only employees must not appear in job composer flows unless they have a real job kind.
   - Platform-specific employees must show clear unsupported-state guidance on other platforms.

4. Admin
   - Verify admin catalog structure every time an employee is added.
   - Admin must show execution type, access policy, platform support, version/download state, and whether the employee is free/public.
   - Free/public employees must be available to existing and new accounts by catalog policy, not by per-user bulk grant rows.

5. Assets And Deploy Script
   - Copy employee assets into `oracle/aimax-reports-api/static/assets/`.
   - Optimize images or other media for web use when needed.
   - Add every new deployed asset to `scripts/deploy_oracle.sh` before deploying.
   - Verify the production asset URL after deployment.

6. Verification
   - Run syntax checks, worker catalog smoke, and HTML script parse checks.
   - Verify the actual user UI with a logged-in test account.
   - Verify admin catalog UI or API.
   - Verify platform branches, especially Windows-only and macOS-disabled states.

7. Deployment And Handoff
   - Deploy to Oracle before reporting completion.
   - After deploy, verify health, `/api/workers`, app HTML, and relevant asset/download URLs.
   - If Windows behavior must be verified, create a Syncthing handoff and copy-paste prompt under `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/<date-topic>/`.
   - Review returned Windows evidence before calling the work fully complete.

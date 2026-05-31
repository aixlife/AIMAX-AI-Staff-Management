# Windows Addendum - R3-N Yeri 300 Word Actual User Flow

## Important Scope Update

Do not treat "it works after starting the runner on this one machine" as sufficient.

For user-facing readiness, verify and report why the Yeri job form is disabled in each environment. The expected blocker chain is:

1. account cannot execute
2. no Yeri entitlement
3. local runner disconnected
4. update required
5. connected runner does not provide Yeri worker
6. local Naver account or selected AI key missing

The UI should expose the blocker reason through the Yeri form notice, and diagnostics/error-report evidence should support it.

## New Mac-Side Change To Port

Port this web UI change:

- `oracle/aimax-reports-api/static/app.html`
  - Add `<option value="300">300자</option>` to `#yeriWordCount`.

Add/run this smoke:

- `scripts/smoke_yeri_web_user_flow_contract.mjs`
  - Expected output: `YERI_WEB_USER_FLOW_CONTRACT_OK`

## Paid Test Rule Update

Do not run paid testing yet from Windows unless explicitly asked after this R3-N gate.

The final paid actual test must be:

- created from the real web UI, not direct API or DOM patching
- 300 chars
- 1 image maximum
- Gemini 2.5 Flash
- draft-save only
- no publish/schedule
- no customer credentials
- no duplicate retry before checking existing job/request state
- cost cap 500 KRW

Because the current production web UI does not yet expose 300 chars, a paid 300-char real-user test cannot be honestly completed on production until the UI change is deployed.

## Return Evidence

Include in the Windows result:

- whether the 300-char option exists in the Windows-tested web UI/source
- disabled-form reason before runner connection
- enabled-form evidence after a safe runner connection
- no paid action performed unless separately approved
- screenshots or visible text evidence for the blocker/ready states

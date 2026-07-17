# AIMAX Functional Parity Matrix

이 문서는 UI 리빌딩 중 기존 기능이 조용히 사라지는 것을 막는 회귀 방지 정본입니다.

Status:

- Phase 1 preview: local fixture only
- Existing production: untouched legacy console
- API integration: not started
- Deployment: not approved

상태 값:

- PREVIEWED: 새 정보 구조와 상태 표현을 fixture로 확인 가능
- DEFERRED: 후속 단계에서 실제 기능 패리티 필요
- PROTECTED: 기존 기능을 변경하지 않았으며 후속 단계에서 반드시 보존
- N/A: 새 구조에서 독립 메뉴로 유지할 필요가 없는 표현 방식

## Authentication and account

| Existing contract | Phase 1 | Phase 2 acceptance |
|---|---|---|
| Email/password login | PROTECTED | Existing session flow and error codes pass unchanged |
| First-login password change | PROTECTED | Required gate blocks execution exactly as legacy |
| Session expiry/logout | PROTECTED | New shell returns to login without data loss or auth loop |
| User status and can_execute | PROTECTED | All gated actions use server result, never client inference |
| Employee entitlements | PROTECTED | Public/member/direct/product policies match worker API |

Phase 1 intentionally has no login because it is a fixture-only separate app. No production auth bypass may be introduced.

## Global operational notices

| Existing contract | Phase 1 | Phase 2 acceptance |
|---|---|---|
| Agent update notice | DEFERRED | Platform/version/download action parity |
| Pending error reports notice | PREVIEWED | Real report counts and routes |
| Job guard notice | PREVIEWED | Guard class, user action, acknowledgement parity |
| Password change notice | PROTECTED | Shown only from authenticated server state |
| Toast/status announcements | PREVIEWED | Live region and message parity |

## Home/dashboard

| Existing contract | Phase 1 | Phase 2 acceptance |
|---|---|---|
| Company/employee explanation | N/A | Move to onboarding/help, not daily priority |
| AIMAX Brain preview | DEFERRED | Include only when it has a real user action |
| Next action guidance | PREVIEWED | Derived from real entitlement/job/connection state |
| Running jobs | PREVIEWED | Real-time or refresh contract defined |
| Waiting for user | PREVIEWED | All paid/permission/input gates surface |
| Recent results | PREVIEWED | Open exact result and preserve ownership |

## Employee catalog

| Existing contract | Phase 1 | Phase 2 acceptance |
|---|---|---|
| GET /api/workers catalog | DEFERRED | Server is the source of truth |
| Search and status filter | PREVIEWED | Real catalog, many-item and no-result tests |
| Execution filter | PREVIEWED | web/local/hybrid/external/platform mappings |
| Access/entitlement state | DEFERRED | public/member/direct/product behavior matches legacy |
| Platform support | DEFERRED | Windows/macOS/mobile unsupported guidance |
| Required settings | PREVIEWED | Status-only readiness, deep link to connection |
| Avatar/profile/release assets | DEFERRED | Broken/missing image fallback |
| Resume dialog content | N/A | Retain useful identity facts in employee detail |
| Download/release links | DEFERRED | Signed/download-ticket behavior unchanged |
| Planned/unavailable worker | DEFERRED | Cannot enter runnable composer |

## Shared task contract

| Existing contract | Phase 1 | Phase 2 acceptance |
|---|---|---|
| Create/queue job | PREVIEWED | Request validation and ownership match legacy |
| queued/running/waiting/failed/done | PREVIEWED | Exact server states mapped visibly |
| Progress and last update | PREVIEWED | No invented progress; stale state indicated |
| User confirmation | PREVIEWED | No paid/irreversible call before server-side confirmation |
| Request/job ID | PREVIEWED | Copyable and preserved in reports |
| Result preview/download | PREVIEWED | Each job kind opens correct output |
| Retry | PREVIEWED | Failed stage only; no automatic paid retry |
| Stop/cancel | DEFERRED | Existing agent/server cancellation semantics |
| Error report from job | PREVIEWED | Sanitized employee/job/stage/context |
| Handoff to next employee | PREVIEWED | Explicit data contract and user consent |

## Employee-specific workspaces

Every existing runnable job kind must get an individual parity row before migration.

| Employee/workflow | Phase 1 | Required parity before switch |
|---|---|---|
| 예리 blog writing | DEFERRED | keywords, CTA, model/image model, local Naver save, schedule/draft safety |
| 현주 neighbor/customer work | DEFERRED | saved messages, local execution, stop/guard behavior |
| 송이 research | DEFERRED | keyword/URL inputs, sources, paid collection guard, result brief |
| 윤미 analysis | DEFERRED | model selection, estimate, explicit confirmation, result/history |
| 상수 web module | DEFERRED | worker contract and result behavior |
| 세무 invoice draft/issue | DEFERRED | direct entitlement, draft, preflight, points/cost, issue confirmation, history |
| 은서 external/mobile tool | DEFERRED | execution options, platform guidance, release link |
| External download employees | DEFERRED | platform-specific download and version metadata |
| 카드뉴스 | DEFERRED | separate branch after shell approval |

No employee workspace may be removed from legacy until its row has executable parity evidence.

## Connections and settings

| Existing contract | Phase 1 | Phase 2 acceptance |
|---|---|---|
| Local agent status/version/last seen | PREVIEWED | Real agent heartbeat and platform mapping |
| Open local settings command | DEFERRED | Existing local command and error behavior |
| Web work settings | DEFERRED | Stored scope, validation, save/restore |
| Gemini/OpenAI/Claude status | PREVIEWED | Existing encrypted status-only API |
| Apify/YouTube status | PREVIEWED | Verification and optional connector wording |
| Pexels status | PREVIEWED | New provider requires separate approved implementation |
| Import local secrets | DEFERRED | Supported providers only; no Naver secrets |
| Save/replace/delete secret | DEFERRED | Raw value never returned; guard release behavior |
| Provider guides | PREVIEWED | Current official links and optional/required distinction |

## Updates, support, and feedback

| Existing contract | Phase 1 | Phase 2 acceptance |
|---|---|---|
| Platform version/download state | PREVIEWED | Windows/macOS version and signed download parity |
| Forced update guard | DEFERRED | Existing minimum-version behavior |
| Error report form | PREVIEWED | Real authenticated report and environment payload |
| Sensitive-data redaction | PREVIEWED | Password/token/key/signed URL exclusion tests |
| Report receipt and status | PREVIEWED | Ticket ID and reviewing/waiting/done states |
| My report history | DEFERRED | Ownership and refresh behavior |
| Employee feedback form | PREVIEWED | Move to employee/result context; backend parity |
| Admin notification | PROTECTED | Existing Telegram/admin workflow unchanged |

## Admin and setup

Admin and setup are not part of the Phase 1 user-console preview.

Before any production switch:

- Admin worker catalog must show execution, access, platform, version, downloads, and public/free policy.
- Admin user, entitlement, report, feedback, and job workflows must be regression tested.
- Setup tokens, password creation, expiry, and one-time use must remain unchanged.
- New frontend assets and deployment paths must be added to deploy scripts only after approval.

## Cross-platform and responsive

| Contract | Phase 1 | Production acceptance |
|---|---|---|
| Desktop wide/intermediate | PREVIEWED | Real data and browser matrix |
| Mobile review/navigation | PREVIEWED | Key flows remain reachable |
| Windows local-agent guidance | DEFERRED | Windows evidence through shared bridge |
| macOS disabled/unsupported states | DEFERRED | Explicit platform branch tests |
| External mobile/Toss tools | DEFERRED | Link and return-path verification |

## Migration rule

For each route:

1. Capture legacy behavior and API responses with sanitized fixtures.
2. Add exact new-route acceptance checks.
3. Run legacy and new UI against the same fixture.
4. Fix failed predicates only.
5. Keep legacy route as fallback until every required row is PASS.
6. Deploy to a separate staging branch or feature flag.
7. Obtain explicit user approval.
8. Switch one route at a time with a documented rollback.

“Looks similar” is not functional parity. A row requires executable evidence before it can move from DEFERRED to PASS.

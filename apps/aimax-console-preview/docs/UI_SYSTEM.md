# AIMAX Rebuild UI System — Phase 1

## Status

- Owner: AIMAX product repository
- Change status: Provisional local preview
- Production consumer: None
- Preview consumer: apps/aimax-console-preview
- Approval path: Local visual/functional review → API parity gate → staging branch review → production approval

## User task and outcome

사용자는 로그인 뒤 여러 AI 직원을 둘러보는 데서 끝나지 않고, 지금 확인해야 할 업무를 처리하고 실행 상태와 결과를 같은 언어로 추적해야 합니다.

Phase 1 프리뷰의 목표:

- 확인 필요, 실행 중, 완료, 실패를 홈과 업무에서 같은 상태 언어로 이해한다.
- 직원 상세에서 역할, 입력, 출력, 비용, 필요한 연결을 확인한 뒤 업무를 시작한다.
- 실제 API 없이 정상·빈·오류·긴 콘텐츠·모바일 상태를 검토한다.

## Existing patterns reused

- 기존 AIMAX의 teal 브랜드 방향과 중립 배경
- 웹/로컬/하이브리드 실행 방식
- 사용자별 연결 상태와 키 원문 비노출 원칙
- 유료 실행 전 확인
- 오류 보고의 접수 ID와 민감정보 제외
- focus-visible과 prefers-reduced-motion

## Foundations

정본: src/styles/tokens.css

- Semantic colors: canvas, surface, ink, muted, line, brand, info, positive, warning, critical
- Type scale: xs, sm, base, md, lg, xl, 2xl, display
- Spacing: 1–9
- Radius: sm, md, lg, xl, pill
- Elevation: soft, panel, modal
- Motion: 140ms fast, 200ms base, ease-out
- Focus: 2px brand outline with visible offset

모든 값은 이번 프리뷰에서 provisional입니다. 최종 브랜드 결정은 이 파일 한곳에서 바꿀 수 있어야 합니다.

## Shared pattern contracts

### AppShell

- Purpose: global navigation, preview boundary, page context, primary new-task action
- Variants: desktop sidebar, compact sidebar, mobile bottom navigation
- States: active route, long page title, local preview banner
- Accessibility: skip link, nav landmark, aria-current, focus-visible
- Consumers: all pages
- Disallowed: employee-specific forms or provider business logic

### StatusBadge

- Purpose: compact semantic state with optional dot
- Variants: neutral, positive, warning, critical, info
- Content: short noun phrase; never rely on color alone
- Consumers: employees, tasks, connections, home notices

### EmployeeCard

- Purpose: select one employee from a catalog while showing identity, role, execution, readiness
- States: default, hover, focus, active, beta, setup required
- Content extremes: long role, long Korean name, missing last-used metadata
- Consumers: EmployeesPage
- Disallowed: full resume or task form

### TaskCard

- Purpose: select one task and understand owner, state, title, time, progress
- States: queued, running, waiting_user, failed, done, active
- Content extremes: long title and summary
- Consumers: WorkPage

### TaskTimeline

- Purpose: explain what happened, what is current, and what comes next
- States: complete, current, upcoming, failed
- Content: each step requires label and recovery-oriented detail
- Consumers: WorkPage and later employee workspaces

### ConnectionCard

- Purpose: status-only view of a provider or runtime connection
- States: connected, missing, attention
- Security: never receives or renders a secret value
- Consumers: ConnectionsPage and later preflight summaries

### Modal

- Purpose: one bounded decision or local preview form above the current page
- Behavior: initial focus, Escape close, focus return, outside click close
- Responsive: centered panel on desktop, bottom sheet on mobile
- Consumers: new task, connection details
- Known limitation: Phase 1 does not yet implement a full Tab focus trap; required before production integration

### EmptyState

- Purpose: explain why content is absent and offer the next meaningful action
- States: full and compact
- Consumers: all page-level lists and details

### Notice

- Purpose: pair reason, impact, and next action
- Variants: info, warning, critical
- Consumers: preflight, safety boundary, failure recovery, connection guidance

## Template and page scenarios

| Template/page | Representative | Extreme/failure | Responsive |
|---|---|---|---|
| Home | waiting/running/results | first user, disconnected, long title | hero stacks, shortcuts reduce columns |
| Employees | search, filter, detail | no employee, no match, long role | master-detail stacks |
| Work | list, detail, timeline | cost confirmation, failed, empty, long task | list/detail stack |
| Connections | grouped cards | all missing, attention | cards stack |
| Help | local report form | required validation, receipt | two columns stack |

## Preview scenario matrix

| Scenario | Data | Expected outcome |
|---|---|---|
| normal | running + waiting + done | representative operating dashboard |
| attention | multiple cost/confirmation tasks | reasons and next actions dominate |
| disconnected | failed task + connection attention | preserved work and recovery path visible |
| empty | no employees or jobs | onboarding and empty-state language |
| long-content | long Korean role/task copy | no horizontal page overflow or hidden primary action |

## Accessibility and motion

- Semantic header, nav, main, section, aside, form, list, and dialog roles
- Labels for every form field
- aria-live for toast and local report receipt
- aria-current for active route
- Text labels accompany every semantic color
- prefers-reduced-motion disables nonessential animation and smooth scrolling
- Buttons use 0.98 active scale; no scale-from-zero entry
- Modal and toast use transform/opacity only

## System impact and follow-up

- Phase 1 does not change existing product consumers.
- Phase 2 must map existing API states to these shared contracts instead of copying legacy page conditions.
- Modal focus trap, automated accessibility audit, real API loading/offline states, and admin density templates remain future gates.
- A reusable pattern is promoted only after at least two real consumers or a clear cross-product responsibility is verified.

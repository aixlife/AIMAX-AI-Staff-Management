# AIMAX 오류 자동수리 파이프라인 실측 감사 (2026-08-30, 읽기 전용)

결론: **"체킹만 되고 수정은 안 된다"가 실측으로 확정됐다.** 수리(코드 수정) 기능은 두 겹으로 꺼져 있다 — (1) 코드 자체가 2026-07-03 commit 0f2ea59 로 "분석·보고 전용"으로 축소됐고, (2) 그 유닛(aimax-error-repair-agent.timer)마저 2026-07-03 19:26:47 stop+disable 된 뒤 57일째 한 번도 안 돌았다. 지금 보이는 "체킹"은 살아 있는 watchdog(30분)과 접수 즉시 알림(server.js)이다.

## (a) 유닛별 현재 상태 (oracle-server = ssh -p 3333 ubuntu@100.69.85.89, systemd --user 스코프. system 스코프에는 유닛 없음(not-found))

| 유닛 | enabled | active | 주기(서버 로드본) | 마지막 실행 |
|---|---|---|---|---|
| aimax-error-repair-agent.timer | disabled | inactive | 15min (서버 /home/ubuntu/.config/systemd/user/ 본. 리포 deploy/systemd/aimax-error-repair-agent.timer:7 은 30min — 드리프트) | 서비스 마지막 실행 2026-07-03 19:23:04 KST, 타이머 Stopped 2026-07-03 19:26:47 (journalctl --user) |
| aimax-report-watchdog.timer | enabled | active | 30min | 2026-08-30 16:54:56 KST — 결과 stale 3건·티켓 2건, send_allowed=false(6h repeat window). 마지막 실제 텔레그램 발송 2026-08-30 03:31:36 UTC(12:31 KST, report-watchdog-state.json) |
| aimax-report-auto-guidance.timer | enabled | active | 5min | 2026-08-30 17:15:54 KST — touched_count 0 |
| aimax-evening-staff-report.timer | disabled | inactive | - | (참고로 함께 확인) |

수리 에이전트 상태 파일 `/home/ubuntu/aimax-reports/data/error-repair-agent-state.json` 은 2026-07-03T10:20:56Z(=19:20 KST) 에서 멈춰 있다(stale 4/티켓 4) — 그날 이후 실행 0회의 물증.

## (b) 수리 기능이 꺼진 경위 타임라인 (전부 journal·git 실측)

- 2026-06-19 20:34:56 timer 시작(30분 주기) — journalctl --user -u aimax-error-repair-agent.timer
- 2026-06-23 14:51:12 15분 주기로 재시작 — 같은 journal
- 6/24~7/3 하루 91~92회 실행 + 매번 텔레그램 발송(중복 억제가 메시지 전문 해시라 한 번도 발동 못 함) — commit 2924a5d 본문, 스크립트 주석 scripts/aimax_error_repair_agent.sh:52-56
- 2026-07-03 17:33 commit 0f2ea59 "Reduce error repair agent to analysis-and-report only" — CEO 결정. 프롬프트에서 "직접 코드 수정까지 완료/GitHub 반영" 지시를 제거하고 "코드 수정, git 커밋/푸시, 파일 생성/삭제, 서비스 재시작, 배포를 절대 하지 않습니다" 로 교체(현재 scripts/aimax_error_repair_agent.sh:90-98). REPEAT 6h→24h, timeout 3600→1800
- 2026-07-03 19:23:04 마지막 실행(launched:true, stale 4/티켓 4) → 19:26:47 timer Stopped+disable — 이후 오늘까지 실행 0회
- 2026-08-18 commit 2924a5d 폭주 원인 수정 — watchdog 이 리포트/티켓 id 기반 안정 서명을 JSON `signature` 로 내보내고(scripts/aimax_report_watchdog.py:247-253,316-320) 에이전트가 그걸 쓰게 변경(scripts/aimax_error_repair_agent.sh:57). **서버 체크아웃에도 반영 확인**(서버 스크립트 57행 동일). 단 타이머는 의도적으로 계속 꺼둠

즉 수리 에이전트는 켜져 있던 6/19~7/3 기간에도 마지막 반나절만 "분석·보고 전용"이었고, 그 이전까지는 수정 권한이 있었다. 7/3 이후로는 분석·보고조차 안 돈다.

## (c) 지금 보이는 "체킹" 신호의 발신 주체 — 2곳, 둘 다 수리 기능과 무관

1. **[AIMAX 오류 자동체킹]** 텔레그램 — `aimax-report-watchdog.timer`(30분) → scripts/aimax_report_watchdog.py:201 의 build_message. 60분 이상 방치된 리포트/열린 티켓을 6h 억제창으로 재알림. 오늘 12:31 KST 실발송 실측.
2. **[AIMAX 오류 보고 접수] / [AIMAX 직원 피드백 접수]** 텔레그램 — 리포트 접수 즉시 oracle/aimax-reports-api/server.js:13435(sendTelegramReportAlert), 호출부 server.js:18824.
- 사용자 화면 쪽 안내문은 `aimax-report-auto-guidance.timer`(5분) → scripts/aimax_report_auto_guidance.py 가 리포트 상태/문구를 갱신 (알림 발송 아님).

## (d) 다시 켜려면 필요한 것과 위험

켜는 것 자체는 1줄: 서버에서 `systemctl --user enable --now aimax-error-repair-agent.timer`. 단,

- **켜도 "수리"는 안 된다** — 현재 코드는 분석·보고 전용(0f2ea59, scripts/aimax_error_repair_agent.sh:90-98). openclaw agent(main, thinking high, timeout 1800s)가 원인 조사 후 텔레그램 보고만 한다. 수리 권한을 되살리려면 7/3 CEO 결정을 뒤집는 프롬프트 원복이 필요 — 이것은 owner 결정.
- **폭주 원인은 수정 완료 상태** — 2924a5d 의 id 기반 안정 서명이 서버 스크립트에 반영돼 있고(57행 실측) smoke 8건 PASS 기록. REPEAT_HOURS=24 라 같은 리포트 집합이면 하루 1회만 발송된다. 리포트 집합이 바뀔 때마다 1회 발송되는 것은 설계상 정상.
- **드리프트 2건 주의**: (1) 서버 로드본 타이머는 15분, 리포 deploy/systemd 본은 30분 — 켜기 전 어느 쪽이 정본인지 정리 필요. (2) 실행 WorkingDirectory 가 배포본이 아니라 `/home/ubuntu/.openclaw/workspace/AIMAX-AI-Staff-Management` 운영 체크아웃이고, 거기엔 wip 커밋 2개(45a06ea, ec1da06)+미추적 파일 3개가 살아 있다 — 에이전트가 읽는 코드가 리포 HEAD 와 다르다.
- **비용/부하**: 실행마다 openclaw main 에이전트 세션 1개(최대 30분) 소모. stale 이 상존하는 현 상태(stale 3/티켓 2)에서는 켜자마자 매일 보고가 온다.
- memory(auto_repair_agent_stopped_20260818) 의 지적 유지: 진짜 문제는 알림 자체가 아니라 감시 지표가 실제 고장을 대표하지 못하는 것 — 켜기 전에 무엇을 보고받고 싶은지부터 정의하는 게 순서.

전 항목 읽기 전용으로 수행 — 서버 상태·코드 변경 없음.

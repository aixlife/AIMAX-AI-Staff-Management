#!/usr/bin/env bash
#
# 배포 직후 확인해야 할 것을 고정해두고 한 번에 돌린다.
#
# 배포할 때마다 "systemd 재시작 → Caddy 리로드 → 라우트 확인"을 손으로 친다.
# 확인하는 라우트도 매번 같다. 사람이 치면 어느 날 하나를 빼먹는다.
#
# 사용법: ./scripts/smoke-oracle.sh
#
# 인증이 필요한 라우트에 실제 인증을 붙이지 않는다.
# 401 이 나오는 것 자체가 확인 대상이다 — 200 이 나오면 인증 게이트가 뚫린 것이다.
#
set -uo pipefail

BASE="${AIMAX_BASE_URL:-https://api.aimax.ai.kr}"
SSH_HOST="ubuntu@100.69.85.89"
SSH_PORT=3333

# 경로 기대코드 설명
ROUTES=(
  "/health|200|헬스체크"
  "/admin|200|관리자 화면이 뜬다"
  "/api/admin/cafe24-orders|401|인증 게이트가 살아 있다"
)

# 서버에서 떠 있어야 하는 서비스 (user 스코프)
USER_SERVICES=(
  "aimax-reports-api"
  "makefamily-plaud-ingest"
)

fail=0
printf '\n  대상 %s\n\n' "$BASE"

printf '  %-34s %-6s %-6s %s\n' "경로" "기대" "실제" "확인 내용"
printf '  %s\n' "────────────────────────────────────────────────────────────────────────"
for entry in "${ROUTES[@]}"; do
  path="${entry%%|*}"
  rest="${entry#*|}"
  want="${rest%%|*}"
  note="${rest#*|}"
  got="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${BASE}${path}")"
  mark="OK"
  if [ "$got" != "$want" ]; then mark="FAIL"; fail=1; fi
  printf '  %-34s %-6s %-6s %s  %s\n' "$path" "$want" "$got" "$note" "$([ "$mark" = FAIL ] && echo '  <= FAIL')"
done

printf '\n  서비스 상태\n'
printf '  %s\n' "────────────────────────────────────────────────────────────────────────"
states="$(ssh -p "$SSH_PORT" -o ConnectTimeout=15 "$SSH_HOST" \
  "for s in ${USER_SERVICES[*]}; do printf '%s %s\n' \"\$s\" \"\$(systemctl --user is-active \$s 2>/dev/null || echo unknown)\"; done" 2>/dev/null)"

if [ -z "$states" ]; then
  printf '  서버에 접속하지 못했습니다.\n'
  fail=1
else
  while read -r name state; do
    [ -z "$name" ] && continue
    printf '  %-34s %s%s\n' "$name" "$state" "$([ "$state" != "active" ] && echo '  <= FAIL')"
    [ "$state" != "active" ] && fail=1
  done <<< "$states"
fi

if [ "$fail" -ne 0 ]; then
  printf '\n  실패한 항목이 있습니다. 배포를 되돌리거나 로그를 보세요.\n'
  printf '  ssh -p %s %s "journalctl --user -u aimax-reports-api -n 40 --no-pager"\n\n' "$SSH_PORT" "$SSH_HOST"
  exit 1
fi

printf '\n  전부 통과했습니다.\n\n'

#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${AIMAX_REPORT_DATA_DIR:-/home/ubuntu/aimax-reports/data}"
STATE_FILE="${AIMAX_REPAIR_AGENT_STATE_FILE:-$DATA_DIR/error-repair-agent-state.json}"
LOCK_FILE="${AIMAX_REPAIR_AGENT_LOCK_FILE:-/tmp/aimax-error-repair-agent.lock}"
STALE_MINUTES="${AIMAX_REPAIR_AGENT_STALE_MINUTES:-60}"
LOOKBACK_DAYS="${AIMAX_REPAIR_AGENT_LOOKBACK_DAYS:-14}"
REPEAT_HOURS="${AIMAX_REPAIR_AGENT_REPEAT_HOURS:-24}"
TELEGRAM_TARGET="${AIMAX_REPAIR_AGENT_TELEGRAM_TARGET:-5925695341}"
TELEGRAM_ACCOUNT="${AIMAX_REPAIR_AGENT_TELEGRAM_ACCOUNT:-personal}"
OPENCLAW_BIN="${AIMAX_REPAIR_AGENT_OPENCLAW_BIN:-/home/ubuntu/.npm-global/bin/openclaw}"

mkdir -p "$DATA_DIR"

with_lock() {
  exec 9>"$LOCK_FILE"
  flock -n 9
}

json_get_number() {
  local json="$1"
  local key="$2"
  printf '%s' "$json" | jq -r "$key // 0"
}

now_iso() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

with_lock || {
  echo '{"ok":true,"skipped":"already_running"}'
  exit 0
}

WATCHDOG_JSON="$(
  cd "$ROOT_DIR"
  python3 scripts/aimax_report_watchdog.py \
    --stale-minutes "$STALE_MINUTES" \
    --lookback-days "$LOOKBACK_DAYS" \
    --limit 20
)"

stale_count="$(json_get_number "$WATCHDOG_JSON" '.stale_report_count')"
ticket_count="$(json_get_number "$WATCHDOG_JSON" '.open_ticket_count')"
if [[ "$stale_count" -eq 0 && "$ticket_count" -eq 0 ]]; then
  jq -n --arg at "$(now_iso)" '{ok:true, skipped:"no_repair_candidates", checked_at:$at}'
  exit 0
fi

signature="$(printf '%s' "$WATCHDOG_JSON" | jq -r '.message' | sha256sum | awk '{print $1}')"
now_epoch="$(date +%s)"
if [[ -f "$STATE_FILE" ]]; then
  last_signature="$(jq -r '.last_signature // ""' "$STATE_FILE" 2>/dev/null || true)"
  last_started_epoch="$(jq -r '.last_started_epoch // 0' "$STATE_FILE" 2>/dev/null || echo 0)"
  repeat_seconds=$((REPEAT_HOURS * 3600))
  if [[ "$signature" == "$last_signature" && $((now_epoch - last_started_epoch)) -lt "$repeat_seconds" ]]; then
    jq -n \
      --arg at "$(now_iso)" \
      --arg signature "$signature" \
      --argjson stale "$stale_count" \
      --argjson tickets "$ticket_count" \
      '{ok:true, skipped:"repeat_window", checked_at:$at, signature:$signature, stale_report_count:$stale, open_ticket_count:$tickets}'
    exit 0
  fi
fi

tmp_state="$(mktemp)"
jq -n \
  --arg at "$(now_iso)" \
  --arg signature "$signature" \
  --argjson epoch "$now_epoch" \
  --argjson stale "$stale_count" \
  --argjson tickets "$ticket_count" \
  '{last_started_at:$at,last_started_epoch:$epoch,last_signature:$signature,stale_report_count:$stale,open_ticket_count:$tickets}' \
  > "$tmp_state"
mv "$tmp_state" "$STATE_FILE"

WATCHDOG_SUMMARY="$(printf '%s' "$WATCHDOG_JSON" | jq -r '.message')"
PROMPT="$(cat <<PROMPT_EOF
AIMAX 오류 분석 담당 자동 실행입니다 (분석·보고 전용 — 어떤 수정도 하지 않습니다).

목표:
1. 아래 watchdog 결과를 기준으로 AIMAX 오류 보고/자동화 티켓을 확인합니다.
2. 원인을 코드/데이터/로그에서 조사하되, 어떤 파일도 수정하지 않습니다.
3. 텔레그램으로 민수님에게만 짧고 명확하게 보고합니다: (a) 분류(사용자 조치형 / 기존 버그 / 신규 패턴), (b) 근거(리포트 ID·로그 위치), (c) 권장 조치 1-2줄. 신규 패턴이면 재현 조건과 증거 파일 경로를 포함합니다.

중요 규칙 (2026-07-03 CEO 확정 — 분석·보고 전용으로 축소):
- 코드 수정, git 커밋/푸시, 파일 생성/삭제, 서비스 재시작, 배포를 절대 하지 않습니다. 수리가 필요한 건은 "맥 Claude Code 정식 라운드 필요"로 보고만 합니다.
- 고객 비밀, API 키, 쿠키, 토큰, 원본 개인정보는 출력/저장하지 않습니다.
- 사용자 조치형(네이버 로그인/AI 키/결제)은 서버 가드레일과 waiting_user 이메일 안내가 자동 처리 중입니다 — 특이사항 없으면 한 줄 요약만 합니다.
- 같은 오류가 반복되고 사용자가 "아직 안 됨"을 눌렀다면 우선순위를 높여 보고합니다.

작업 디렉터리:
$ROOT_DIR

watchdog 결과:
$WATCHDOG_SUMMARY
PROMPT_EOF
)"

"$OPENCLAW_BIN" agent \
  --agent main \
  --channel telegram \
  --to "$TELEGRAM_TARGET" \
  --reply-account "$TELEGRAM_ACCOUNT" \
  --reply-channel telegram \
  --reply-to "$TELEGRAM_TARGET" \
  --message "$PROMPT" \
  --thinking high \
  --timeout 1800 \
  --deliver

jq -n \
  --arg at "$(now_iso)" \
  --arg signature "$signature" \
  --argjson stale "$stale_count" \
  --argjson tickets "$ticket_count" \
  '{ok:true, launched:true, completed_at:$at, signature:$signature, stale_report_count:$stale, open_ticket_count:$tickets}'

#!/usr/bin/env bash
# AIMAX AI 직원 데이터 야간 암호화 백업
#
# 왜 있나: 2026-08-25 점검에서 라운지·블루밍본·수출선생은 매일 백업이 도는데
# AIMAX 사용자 데이터(계정·작업·산출물·암호화된 사용자 API 키)만 백업이 없었다.
# 오라클 인스턴스 한 대에만 있어서 디스크가 날아가면 복구 수단이 없다.
#
# 어디로: 암호화한 뒤 liki(24시간 켜진 윈도우, Tailscale 사설망)로 보낸다.
# 서버 14일 + liki 30일 보관. 클라우드 계정도 추가 비용도 쓰지 않는다.
set -euo pipefail

SRC=/home/ubuntu/aimax-reports/data
DIR=/home/ubuntu/aimax-data-backups
LIKI_HOST=likim@100.95.243.74
LIKI_DIR='C:/Users/likim/AIMAX-backups'
SSH_KEY=/home/ubuntu/.ssh/aimax_backup_to_liki
ENV_FILE=/home/ubuntu/.aimax/backup.env
API_ENV=/home/ubuntu/aimax-reports-api/.env

mkdir -p "$DIR"
LOG="$DIR/backup.log"
STAMP="$(date +%F)"
OUT="$DIR/aimax-data-$STAMP.tar.gz.enc"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

notify_fail() {
  local msg="$1"
  echo "$(date -Is) FAIL $msg" >> "$LOG"
  local token chat thread
  token="$(grep -m1 '^AIMAX_TELEGRAM_BOT_TOKEN=' "$API_ENV" 2>/dev/null | cut -d= -f2- || true)"
  chat="$(grep -m1 '^AIMAX_TELEGRAM_CHAT_ID=' "$API_ENV" 2>/dev/null | cut -d= -f2- || true)"
  thread="$(grep -m1 '^AIMAX_TELEGRAM_MESSAGE_THREAD_ID=' "$API_ENV" 2>/dev/null | cut -d= -f2- || true)"
  if [ -n "$token" ] && [ -n "$chat" ]; then
    curl -s -m 20 -X POST "https://api.telegram.org/bot${token}/sendMessage" \
      --data-urlencode "chat_id=${chat}" \
      ${thread:+--data-urlencode "message_thread_id=${thread}"} \
      --data-urlencode "text=AIMAX 데이터 백업 실패 — ${msg} (서버 ~/aimax-data-backups/backup.log 확인)" >/dev/null || true
  fi
  exit 1
}

# 1. 압축 + 암호화
#    잡 파일은 백업 도중에도 갱신되므로 tar 의 "파일이 바뀌었다" 경고는 실패로 보지 않는다.
#    대신 아래 무결성 확인을 통과해야만 성공으로 친다.
set +o pipefail
tar -C "$(dirname "$SRC")" \
    --exclude='*.tmp' \
    --exclude='*.bak' \
    --exclude='*.bak-*' \
    --exclude='*.bak.*' \
    --exclude='media-cache' \
    --warning=no-file-changed \
    -czf - "$(basename "$SRC")" 2>/dev/null \
  | openssl enc -aes-256-cbc -pbkdf2 -pass env:AIMAX_BACKUP_PASSPHRASE -out "$OUT"
set -o pipefail

[ -s "$OUT" ] || notify_fail "빈 아카이브"

# 2. 무결성 — 실제로 풀리는지 확인한다. 열리는지 확인하지 않은 파일은 백업이 아니다.
if ! openssl enc -d -aes-256-cbc -pbkdf2 -pass env:AIMAX_BACKUP_PASSPHRASE -in "$OUT" 2>/dev/null \
     | tar -tzf - >/dev/null 2>&1; then
  notify_fail "복호화/압축해제 검증 실패"
fi

SIZE="$(du -h "$OUT" | cut -f1)"

# 3. liki 로 전송
if ! scp -i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 \
     -q "$OUT" "$LIKI_HOST:$LIKI_DIR/"; then
  notify_fail "liki 전송 실패 (서버 사본은 남아 있음)"
fi

# 4. 보관 정리 — 서버 14일, liki 30일
find "$DIR" -name 'aimax-data-*.tar.gz.enc' -mtime +14 -delete 2>/dev/null || true
ssh -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=20 "$LIKI_HOST" \
  "powershell -NoProfile -Command \"Get-ChildItem 'C:\\Users\\likim\\AIMAX-backups\\aimax-data-*.tar.gz.enc' -ErrorAction SilentlyContinue | Where-Object { \\\$_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Force\"" \
  >/dev/null 2>&1 || true

echo "$(date -Is) ok $SIZE 서버+liki" >> "$LOG"

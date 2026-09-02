#!/usr/bin/env bash
#
# 새로 빌드한 맥 앱을 /Applications 에 안전하게 갈아끼우고 실행까지 확인한다.
#
# 손으로 하면 매번 같은 곳에서 막힌다 — 재빌드 번들은 codesign --deep --strict 가
# 실패해서 ad-hoc 재서명으로 풀어야 한다. 그리고 백업이 /Applications 에 쌓인다
# (지금 AIMAX.app.backup-* 만 8개, MaxAlert.app.bak-* 가 4개 있다).
#
# 사용법:
#   ./scripts/install-local-build.sh dist/AIMAX.app
#   ./scripts/install-local-build.sh dist/AIMAX.app --target-dir /tmp/앱시험   # 시험용
#   ./scripts/install-local-build.sh --rollback "AIMAX"
#
# 앱을 포그라운드로 띄우지 않는다. 실행 확인은 프로세스가 살아 있는지까지만 본다.
#
set -uo pipefail

TARGET_DIR="/Applications"
BACKUP_DIR="$HOME/Library/Application Support/aimax-app-backups"
ROLLBACK_NAME=""
SRC=""

while [ $# -gt 0 ]; do
  case "$1" in
    --target-dir) TARGET_DIR="$2"; shift ;;
    --rollback) ROLLBACK_NAME="$2"; shift ;;
    *) SRC="$1" ;;
  esac
  shift
done

say() { printf '\n[%s]\n' "$1"; }
ok()  { printf '  %s\n' "$1"; }
die() { printf '\n실패: %s\n\n' "$1" >&2; exit 1; }

bundle_version() {
  /usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$1/Contents/Info.plist" 2>/dev/null \
    || echo "알 수 없음"
}

# ------------------------------------------------------------------ 되돌리기
if [ -n "$ROLLBACK_NAME" ]; then
  latest="$(ls -1dt "$BACKUP_DIR/$ROLLBACK_NAME"*.app 2>/dev/null | head -1)"
  [ -n "$latest" ] || die "백업이 없습니다: $BACKUP_DIR/$ROLLBACK_NAME*"
  say "되돌리기"
  ok "백업 $latest ($(bundle_version "$latest"))"
  rm -rf "$TARGET_DIR/$ROLLBACK_NAME.app"
  cp -R "$latest" "$TARGET_DIR/$ROLLBACK_NAME.app" || die "복원 실패"
  ok "복원 완료: $TARGET_DIR/$ROLLBACK_NAME.app"
  exit 0
fi

[ -n "$SRC" ] || die "사용법: $0 <빌드된.app경로> [--target-dir DIR]"
[ -d "$SRC" ] || die "번들이 없습니다: $SRC"

APP_NAME="$(basename "$SRC" .app)"
DEST="$TARGET_DIR/$APP_NAME.app"
NEW_VER="$(bundle_version "$SRC")"
mkdir -p "$TARGET_DIR" "$BACKUP_DIR"

say "대상"
ok "$SRC ($NEW_VER)  →  $DEST"

# -------------------------------------------------------------------- 백업
OLD_VER="없음"
BACKUP=""
if [ -d "$DEST" ]; then
  OLD_VER="$(bundle_version "$DEST")"
  BACKUP="$BACKUP_DIR/${APP_NAME}-${OLD_VER}-$(date +%Y%m%d%H%M%S).app"
  say "백업"
  # /Applications 옆에 쌓지 않는다. 지금까지 그렇게 해서 백업이 12개 굴러다닌다.
  cp -R "$DEST" "$BACKUP" || die "백업 실패. 아무것도 건드리지 않았습니다."
  ok "$BACKUP"
  # 백업은 최근 3개만 남긴다.
  ls -1dt "$BACKUP_DIR/${APP_NAME}-"*.app 2>/dev/null | tail -n +4 | while read -r old; do rm -rf "$old"; done
fi

restore() {
  [ -n "$BACKUP" ] || { printf '  되돌릴 백업이 없습니다.\n' >&2; return; }
  rm -rf "$DEST"
  cp -R "$BACKUP" "$DEST" && printf '  이전 버전(%s)으로 되돌렸습니다.\n' "$OLD_VER" >&2
}

# -------------------------------------------------------------------- 설치
say "설치"
rm -rf "$DEST"
if ! cp -R "$SRC" "$DEST"; then
  restore
  die "복사에 실패했습니다."
fi
ok "복사 완료"

# -------------------------------------------------------------------- 서명
say "서명"
if codesign --verify --deep --strict "$DEST" 2>/dev/null; then
  ok "기존 서명 유효"
else
  # 재빌드 번들은 여기서 거의 항상 걸린다. 조용히 넘기지 말고 무엇을 왜 했는지 남긴다.
  ok "서명 검증 실패 — ad-hoc 으로 강제 재서명합니다 (재빌드 번들에서 흔한 경우)"
  if codesign --force --deep --sign - "$DEST" 2>/dev/null; then
    ok "재서명 완료"
  else
    restore
    die "재서명까지 실패했습니다. 되돌렸습니다."
  fi
fi

# ------------------------------------------------------------------ 실행 확인
say "실행 확인"
BIN="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$DEST/Contents/Info.plist" 2>/dev/null)"
if [ -z "$BIN" ] || [ ! -x "$DEST/Contents/MacOS/$BIN" ]; then
  restore
  die "실행 파일을 못 찾았습니다. 번들이 온전하지 않습니다."
fi
ok "실행 파일 확인: $BIN"

# 포그라운드로 띄우지 않는다. 백그라운드로 열고 프로세스만 확인한다.
open -g -a "$DEST" 2>/dev/null
sleep 4
# 경로로만 확인한다. 이름으로 보면 다른 위치의 같은 앱이 떠 있을 때 통과해버린다.
if pgrep -f "$DEST/Contents/MacOS/$BIN" >/dev/null 2>&1; then
  ok "3초 넘게 살아 있습니다"
else
  printf '\n  즉시 종료됐습니다. 최근 로그:\n' >&2
  log show --predicate "process == \"$BIN\"" --last 2m --style compact 2>/dev/null | tail -20 >&2
  restore
  die "앱이 실행 직후 죽었습니다. 되돌렸습니다."
fi

printf '\n설치 완료: %s  →  %s\n' "$OLD_VER" "$NEW_VER"
[ -n "$BACKUP" ] && printf '되돌리려면: %s --rollback "%s"\n' "$0" "$APP_NAME"
printf '\n'

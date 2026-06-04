#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

REMOTE_HOST="${AIMAX_DEPLOY_HOST:-oracle-server}"
REMOTE_APP_DIR="${AIMAX_REMOTE_APP_DIR:-/home/ubuntu/aimax-reports-api}"
REMOTE_DOWNLOAD_DIR="${AIMAX_REMOTE_DOWNLOAD_DIR:-/home/ubuntu/aimax-downloads}"
REMOTE_SERVICE="${AIMAX_REMOTE_SERVICE:-aimax-reports-api.service}"
REMOTE_BACKUP_ROOT="${AIMAX_REMOTE_BACKUP_ROOT:-/home/ubuntu/aimax-backups}"
MODE="web"
DRY_RUN=0

usage() {
  cat <<'USAGE'
Usage:
  scripts/deploy_oracle.sh [web|external-staff|macos-bundle|windows-bundle|bundle-installers|installers|all] [--dry-run]

Modes:
  web                Deploy server.js and static web/admin HTML
  external-staff     Deploy external staff Windows EXE files only
  macos-bundle       Deploy the unified macOS bundle installer only
  windows-bundle     Deploy the unified Windows bundle installer only
  bundle-installers  Deploy unified macOS/Windows bundle installers only
  installers         Deploy legacy macOS/Windows bundle + individual installer files
  all                Deploy server/static files and all legacy installer files

Environment overrides:
  AIMAX_DEPLOY_HOST
  AIMAX_REMOTE_APP_DIR
  AIMAX_REMOTE_DOWNLOAD_DIR
  AIMAX_REMOTE_SERVICE
  AIMAX_REMOTE_BACKUP_ROOT
USAGE
}

for arg in "$@"; do
  case "$arg" in
    web|external-staff|macos-bundle|windows-bundle|bundle-installers|installers|all)
      MODE="$arg"
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[ERROR] unknown argument: $arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

timestamp() {
  date +"%Y%m%d-%H%M%S"
}

sha256_local() {
  shasum -a 256 "$1" | awk '{print $1}'
}

require_file() {
  if [[ ! -f "$1" ]]; then
    echo "[ERROR] missing file: $1" >&2
    exit 1
  fi
}

add_file() {
  local source_path="$1"
  local remote_path="$2"
  local label="$3"
  require_file "$source_path"
  SOURCES+=("$source_path")
  TARGETS+=("$remote_path")
  LABELS+=("$label")
}

SOURCES=()
TARGETS=()
LABELS=()

if [[ "$MODE" == "web" || "$MODE" == "all" ]]; then
  add_file \
    "$ROOT_DIR/oracle/aimax-reports-api/server.js" \
    "$REMOTE_APP_DIR/server.js" \
    "api server"
  add_file \
    "$ROOT_DIR/oracle/aimax-reports-api/static/app.html" \
    "$REMOTE_APP_DIR/static/app.html" \
    "web app"
  add_file \
    "$ROOT_DIR/oracle/aimax-reports-api/static/admin.html" \
    "$REMOTE_APP_DIR/static/admin.html" \
    "admin app"
  add_file \
    "$ROOT_DIR/oracle/aimax-reports-api/static/setup.html" \
    "$REMOTE_APP_DIR/static/setup.html" \
    "setup app"
  add_file \
    "$ROOT_DIR/oracle/aimax-reports-api/static/assets/avatar_nakyung.jpg" \
    "$REMOTE_APP_DIR/static/assets/avatar_nakyung.jpg" \
    "avatar nakyung"
  add_file \
    "$ROOT_DIR/oracle/aimax-reports-api/static/assets/avatar_hyunseong.jpg" \
    "$REMOTE_APP_DIR/static/assets/avatar_hyunseong.jpg" \
    "avatar hyunseong"
  add_file \
    "$ROOT_DIR/oracle/aimax-reports-api/static/assets/avatar_sangsu.jpg" \
    "$REMOTE_APP_DIR/static/assets/avatar_sangsu.jpg" \
    "avatar sangsu"
  add_file \
    "$ROOT_DIR/oracle/aimax-reports-api/static/assets/avatar_yunmi.jpg" \
    "$REMOTE_APP_DIR/static/assets/avatar_yunmi.jpg" \
    "avatar yunmi"
  add_file \
    "$ROOT_DIR/oracle/aimax-reports-api/static/assets/avatar_songi.jpg" \
    "$REMOTE_APP_DIR/static/assets/avatar_songi.jpg" \
    "avatar songi"
  add_file \
    "$ROOT_DIR/oracle/aimax-reports-api/static/assets/avatar_jieun.jpg" \
    "$REMOTE_APP_DIR/static/assets/avatar_jieun.jpg" \
    "avatar jieun"
  add_file \
    "$ROOT_DIR/oracle/aimax-reports-api/static/assets/aimax-brain-preview.mp4" \
    "$REMOTE_APP_DIR/static/assets/aimax-brain-preview.mp4" \
    "aimax brain preview"
  add_file \
    "$ROOT_DIR/oracle/aimax-reports-api/static/assets/aimax-brain-preview.webm" \
    "$REMOTE_APP_DIR/static/assets/aimax-brain-preview.webm" \
    "aimax brain preview webm"
  add_file \
    "$ROOT_DIR/oracle/aimax-reports-api/static/assets/avatar_placeholder.svg" \
    "$REMOTE_APP_DIR/static/assets/avatar_placeholder.svg" \
    "avatar placeholder"
fi

if [[ "$MODE" == "macos-bundle" || "$MODE" == "bundle-installers" || "$MODE" == "installers" || "$MODE" == "all" ]]; then
  add_file "$ROOT_DIR/dist/upload_installers/aimax-bundle-macos.dmg" "$REMOTE_DOWNLOAD_DIR/aimax-bundle-macos.dmg" "macOS bundle"
fi

if [[ "$MODE" == "windows-bundle" || "$MODE" == "bundle-installers" || "$MODE" == "installers" || "$MODE" == "all" ]]; then
  add_file "$ROOT_DIR/dist/upload_installers/aimax-bundle-windows.exe" "$REMOTE_DOWNLOAD_DIR/aimax-bundle-windows.exe" "Windows bundle"
fi

if [[ "$MODE" == "external-staff" || "$MODE" == "all" ]]; then
  add_file "$ROOT_DIR/dist/upload_installers/AIMAX-Office-Manager-Setup-0.1.5.exe" "$REMOTE_DOWNLOAD_DIR/AIMAX-Office-Manager-Setup-0.1.5.exe" "Jieun Office setup"
  add_file "$ROOT_DIR/dist/upload_installers/AIMAX-Office-Manager-portable.exe" "$REMOTE_DOWNLOAD_DIR/AIMAX-Office-Manager-portable.exe" "Jieun Office portable"
  add_file "$ROOT_DIR/dist/upload_installers/Pencil-Setup-1.0.0.exe" "$REMOTE_DOWNLOAD_DIR/Pencil-Setup-1.0.0.exe" "Nakyung Pencil setup"
  add_file "$ROOT_DIR/dist/upload_installers/Pencil-portable.exe" "$REMOTE_DOWNLOAD_DIR/Pencil-portable.exe" "Nakyung Pencil portable"
fi

if [[ "$MODE" == "installers" || "$MODE" == "all" ]]; then
  add_file "$ROOT_DIR/dist/upload_installers/aimax-yeri-macos.dmg" "$REMOTE_DOWNLOAD_DIR/aimax-yeri-macos.dmg" "macOS yeri"
  add_file "$ROOT_DIR/dist/upload_installers/aimax-hyunju-macos.dmg" "$REMOTE_DOWNLOAD_DIR/aimax-hyunju-macos.dmg" "macOS hyunju"
  add_file "$ROOT_DIR/dist/upload_installers/aimax-yeri-windows.exe" "$REMOTE_DOWNLOAD_DIR/aimax-yeri-windows.exe" "Windows yeri"
  add_file "$ROOT_DIR/dist/upload_installers/aimax-hyunju-windows.exe" "$REMOTE_DOWNLOAD_DIR/aimax-hyunju-windows.exe" "Windows hyunju"
fi

if [[ ${#SOURCES[@]} -eq 0 ]]; then
  echo "[ERROR] no files selected" >&2
  exit 1
fi

REPORT_DIR="$ROOT_DIR/docs/deployments"
mkdir -p "$REPORT_DIR"

BASE_TS="$(timestamp)"
TS="$BASE_TS"
suffix=1
while [[ -e "$REPORT_DIR/oracle-deploy-$TS.md" ]]; do
  TS="$BASE_TS-$suffix"
  suffix=$((suffix + 1))
done

REMOTE_TMP="/tmp/aimax-deploy-$TS"
REMOTE_BACKUP_DIR="$REMOTE_BACKUP_ROOT/$TS"
REPORT_PATH="$REPORT_DIR/oracle-deploy-$TS.md"

{
  echo "# Oracle Deploy $TS"
  echo
  echo "- mode: \`$MODE\`"
  echo "- dry_run: \`$DRY_RUN\`"
  echo "- host: \`$REMOTE_HOST\`"
  echo "- app_dir: \`$REMOTE_APP_DIR\`"
  echo "- download_dir: \`$REMOTE_DOWNLOAD_DIR\`"
  echo "- service: \`$REMOTE_SERVICE\`"
  echo "- remote_backup: \`$REMOTE_BACKUP_DIR\`"
  echo
  echo "## Files"
  echo
  echo "| label | local | remote | sha256 |"
  echo "|---|---|---|---|"
} > "$REPORT_PATH"

echo "[PLAN] Oracle deploy mode=$MODE dry_run=$DRY_RUN"
echo "[PLAN] host=$REMOTE_HOST"
echo "[PLAN] backup=$REMOTE_BACKUP_DIR"

for index in "${!SOURCES[@]}"; do
  source_path="${SOURCES[$index]}"
  remote_path="${TARGETS[$index]}"
  label="${LABELS[$index]}"
  checksum="$(sha256_local "$source_path")"
  printf '[FILE] %-16s %s -> %s %s\n' "$label" "$source_path" "$remote_path" "$checksum"
  printf '| %s | `%s` | `%s` | `%s` |\n' "$label" "$source_path" "$remote_path" "$checksum" >> "$REPORT_PATH"
done

if [[ "$DRY_RUN" -eq 1 ]]; then
  {
    echo
    echo "## Result"
    echo
    echo "Dry run only. No remote files were changed."
  } >> "$REPORT_PATH"
  echo "[DRY-RUN] report=$REPORT_PATH"
  exit 0
fi

echo "[REMOTE] preparing tmp and backup directories"
ssh -o BatchMode=yes "$REMOTE_HOST" "set -e; mkdir -p '$REMOTE_TMP' '$REMOTE_BACKUP_DIR'"

for index in "${!SOURCES[@]}"; do
  source_path="${SOURCES[$index]}"
  remote_path="${TARGETS[$index]}"
  remote_name="$(basename "$remote_path")"
  echo "[UPLOAD] $source_path"
  scp "$source_path" "$REMOTE_HOST:$REMOTE_TMP/$remote_name" >/dev/null
  echo "[BACKUP] $remote_path"
  ssh -o BatchMode=yes "$REMOTE_HOST" "set -e; if [ -f '$remote_path' ]; then cp '$remote_path' '$REMOTE_BACKUP_DIR/$remote_name'; fi"
  echo "[INSTALL] $remote_path"
  ssh -o BatchMode=yes "$REMOTE_HOST" "set -e; install -m 0644 '$REMOTE_TMP/$remote_name' '$remote_path'"
done

echo "[SERVICE] restarting $REMOTE_SERVICE"
ssh -o BatchMode=yes "$REMOTE_HOST" "set -e; systemctl --user restart '$REMOTE_SERVICE'; sleep 2; systemctl --user is-active '$REMOTE_SERVICE'"

{
  echo
  echo "## Remote SHA"
  echo
  echo '```text'
} >> "$REPORT_PATH"

remote_sha_command="sha256sum"
for remote_path in "${TARGETS[@]}"; do
  remote_sha_command="$remote_sha_command '$remote_path'"
done
ssh -o BatchMode=yes "$REMOTE_HOST" "$remote_sha_command" | tee -a "$REPORT_PATH"

{
  echo '```'
  echo
  echo "## Service Status"
  echo
  echo '```text'
} >> "$REPORT_PATH"
ssh -o BatchMode=yes "$REMOTE_HOST" "systemctl --user status '$REMOTE_SERVICE' --no-pager | sed -n '1,12p'" | tee -a "$REPORT_PATH"
{
  echo '```'
  echo
  echo "## Result"
  echo
  echo "Deployment completed."
} >> "$REPORT_PATH"

echo "[DONE] report=$REPORT_PATH"

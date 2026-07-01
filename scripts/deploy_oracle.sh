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
  scripts/deploy_oracle.sh [web|eunseo-mac|external-staff|macos-bundle|windows-bundle|bundle-installers|installers|all] [--dry-run]

Modes:
  web                Deploy server.js and static web/admin HTML
  eunseo-mac         Deploy Eunseo Mac prompter zip only
  external-staff     Deploy external staff download files only
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
    web|eunseo-mac|external-staff|macos-bundle|windows-bundle|bundle-installers|installers|all)
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

preflight_web_guard() {
  if [[ "${AIMAX_DEPLOY_SKIP_GUARD:-}" == "1" ]]; then
    echo "[DEPLOY][WARN] AIMAX_DEPLOY_SKIP_GUARD=1 — 웹 배포 가드를 건너뜁니다. 카탈로그 회귀 위험 직접 확인." >&2
    return 0
  fi
  local server_js="$ROOT_DIR/oracle/aimax-reports-api/server.js"
  require_file "$server_js"
  # 라이브 카탈로그/모델 마커 — 옛/분기 브랜치의 server.js 를 배포하면 직원 카탈로그가 회귀한다.
  local missing=()
  grep -q "jieun_office_support" "$server_js" || missing+=("jieun_office_support 직원")
  grep -q "sangsu_quote" "$server_js" || missing+=("sangsu_quote 상수견적 잡")
  grep -q "normalizeYeriGeminiModel" "$server_js" || missing+=("flash 모델 정규화 함수")
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "[DEPLOY][ABORT] server.js 에 라이브 마커 누락 — 옛/분기 브랜치를 배포 중일 수 있습니다:" >&2
    local m; for m in "${missing[@]}"; do echo "  - $m" >&2; done
    echo "  통합 정본 브랜치를 체크아웃하세요. (긴급 우회: AIMAX_DEPLOY_SKIP_GUARD=1)" >&2
    exit 3
  fi
  if command -v node >/dev/null 2>&1; then
    node --check "$server_js" || { echo "[DEPLOY][ABORT] server.js 문법 오류 — 배포 중단" >&2; exit 3; }
  fi
  local br; br="$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
  echo "[DEPLOY] web preflight OK — 브랜치=$br, 라이브 카탈로그/모델 마커 + 문법 확인."
}

SOURCES=()
TARGETS=()
LABELS=()

if [[ "$MODE" == "web" || "$MODE" == "all" ]]; then
  preflight_web_guard
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
    "$ROOT_DIR/oracle/aimax-reports-api/static/eunseo/index.html" \
    "$REMOTE_APP_DIR/static/eunseo/index.html" \
    "eunseo web app"
  add_file \
    "$ROOT_DIR/oracle/aimax-reports-api/static/eunseo/manifest.webmanifest" \
    "$REMOTE_APP_DIR/static/eunseo/manifest.webmanifest" \
    "eunseo manifest"
  add_file \
    "$ROOT_DIR/oracle/aimax-reports-api/static/eunseo/sw.js" \
    "$REMOTE_APP_DIR/static/eunseo/sw.js" \
    "eunseo service worker"
  add_file \
    "$ROOT_DIR/oracle/aimax-reports-api/static/assets/avatar_eunseo.jpg" \
    "$REMOTE_APP_DIR/static/assets/avatar_eunseo.jpg" \
    "avatar eunseo"
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

if [[ "$MODE" == "eunseo-mac" || "$MODE" == "external-staff" || "$MODE" == "all" ]]; then
  add_file "$ROOT_DIR/dist/upload_installers/EunseoPrompter-mac-0.1.0.zip" "$REMOTE_DOWNLOAD_DIR/EunseoPrompter-mac-0.1.0.zip" "Eunseo Mac zip"
fi

if [[ "$MODE" == "external-staff" || "$MODE" == "all" ]]; then
  add_file "$ROOT_DIR/dist/upload_installers/AIMAX-Office-Manager-Setup-0.1.6.exe" "$REMOTE_DOWNLOAD_DIR/AIMAX-Office-Manager-Setup-0.1.6.exe" "Jieun Office setup"
  add_file "$ROOT_DIR/dist/upload_installers/AIMAX-Office-Manager-macOS-0.2.0-aarch64.dmg" "$REMOTE_DOWNLOAD_DIR/AIMAX-Office-Manager-macOS-0.2.0-aarch64.dmg" "Jieun Office macOS DMG"
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
  ssh -o BatchMode=yes "$REMOTE_HOST" "set -e; mkdir -p '$(dirname "$remote_path")'; install -m 0644 '$REMOTE_TMP/$remote_name' '$remote_path'"
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

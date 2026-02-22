#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AUTOMATION_DIR="$ROOT_DIR/automation"
RUNTIME_DIR="$AUTOMATION_DIR/runtime"
ARTIFACTS_DIR="$AUTOMATION_DIR/artifacts"
REPORTS_DIR="$AUTOMATION_DIR/reports"
ENV_FILE_DEFAULT="$AUTOMATION_DIR/.env.overnight"

mkdir -p "$RUNTIME_DIR" "$ARTIFACTS_DIR" "$REPORTS_DIR"

log() {
  local level="$1"
  shift
  printf '[%s] [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$level" "$*"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log ERROR "Missing required command: $cmd"
    return 1
  fi
}

load_env() {
  local env_file="${1:-$ENV_FILE_DEFAULT}"
  if [[ ! -f "$env_file" ]]; then
    log ERROR "Env file not found: $env_file"
    return 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a

  export BACKEND_PORT="${BACKEND_PORT:-4100}"
  export FRONTEND_PORT="${FRONTEND_PORT:-4173}"
  export CLIENT_ORIGIN="${CLIENT_ORIGIN:-http://127.0.0.1:${FRONTEND_PORT}}"
  export PW_HEADLESS="${PW_HEADLESS:-true}"
  export PW_WORKERS="${PW_WORKERS:-2}"
  export PW_PROJECTS="${PW_PROJECTS:-chromium-desktop}"
  export PW_MAX_FAILURES="${PW_MAX_FAILURES:-6}"
  export PW_RETRIES="${PW_RETRIES:-0}"
  export PW_TEST_TARGETS="${PW_TEST_TARGETS:-tests/auth-rbac.spec.js tests/participant-flows.spec.js}"
  export MAX_CYCLES="${MAX_CYCLES:-30}"
  export CYCLE_TIMEOUT_MINUTES="${CYCLE_TIMEOUT_MINUTES:-35}"
  export CODEX_TIMEOUT_MINUTES="${CODEX_TIMEOUT_MINUTES:-18}"
  export CODEX_FIX_ATTEMPTS="${CODEX_FIX_ATTEMPTS:-2}"
  export RUN_CODEX_EXPLORER="${RUN_CODEX_EXPLORER:-true}"
  export RUN_CODEX_ON_FAILURE="${RUN_CODEX_ON_FAILURE:-true}"
}

wait_for_http() {
  local url="$1"
  local timeout_seconds="${2:-60}"
  local started
  started="$(date +%s)"

  while true; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi

    if (( "$(date +%s)" - started >= timeout_seconds )); then
      log ERROR "Timed out waiting for $url"
      return 1
    fi

    sleep 1
  done
}

is_true() {
  case "${1:-}" in
    1|true|TRUE|yes|YES|on|ON) return 0 ;;
    *) return 1 ;;
  esac
}

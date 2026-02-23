#!/usr/bin/env bash
set -Eeuo pipefail

source "$(dirname "$0")/common.sh"
ENV_FILE="${1:-$ENV_FILE_DEFAULT}"
load_env "$ENV_FILE"

CYCLE_DIR="${2:-$ARTIFACTS_DIR/manual}"
if [[ "$CYCLE_DIR" != /* ]]; then
  CYCLE_DIR="$ROOT_DIR/$CYCLE_DIR"
fi
mkdir -p "$CYCLE_DIR"

BACKEND_LOG="$CYCLE_DIR/backend.log"
FRONTEND_LOG="$CYCLE_DIR/frontend.log"
PIDS_FILE="$RUNTIME_DIR/services.pids"
EFFECTIVE_CLIENT_ORIGIN="http://127.0.0.1:${FRONTEND_PORT}"

cleanup_on_failure() {
  local status="$?"
  if (( status != 0 )); then
    log WARN "Startup failed; stopping started services"
    bash "$(dirname "$0")/stop_services.sh" >/dev/null 2>&1 || true
  fi
}

assert_pid_running() {
  local pid="$1"
  local name="$2"
  local log_file="$3"

  if kill -0 "$pid" >/dev/null 2>&1; then
    return 0
  fi

  log ERROR "$name exited during startup"
  if [[ -f "$log_file" ]]; then
    log ERROR "Last lines from $name log:"
    tail -n 30 "$log_file" || true
  fi
  return 1
}

trap cleanup_on_failure EXIT

log INFO "Starting backend on :$BACKEND_PORT"
if [[ "${CLIENT_ORIGIN}" != "$EFFECTIVE_CLIENT_ORIGIN" ]]; then
  log WARN "Overriding CLIENT_ORIGIN=${CLIENT_ORIGIN} to ${EFFECTIVE_CLIENT_ORIGIN} to match FRONTEND_PORT"
fi

nohup env \
  PORT="$BACKEND_PORT" \
  MONGODB_URI="$MONGODB_URI" \
  JWT_SECRET="$JWT_SECRET" \
  CLIENT_ORIGIN="$EFFECTIVE_CLIENT_ORIGIN" \
  UPLOAD_DIR="${UPLOAD_DIR:-./uploads-overnight}" \
  SMTP_HOST="$SMTP_HOST" \
  SMTP_PORT="$SMTP_PORT" \
  SMTP_SECURE="$SMTP_SECURE" \
  SMTP_FROM="$SMTP_FROM" \
  IIIT_EMAIL_DOMAINS="$IIIT_EMAIL_DOMAINS" \
  ADMIN_EMAIL="$ADMIN_EMAIL" \
  ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  ADMIN_NAME="$ADMIN_NAME" \
  npm --prefix "$ROOT_DIR/backend" run dev >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

log INFO "Starting frontend on :$FRONTEND_PORT"
nohup env \
  VITE_API_BASE_URL="http://127.0.0.1:${BACKEND_PORT}" \
  npm --prefix "$ROOT_DIR/frontend" run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT" --strictPort >"$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

printf '%s\n' "$BACKEND_PID" "$FRONTEND_PID" > "$PIDS_FILE"

assert_pid_running "$BACKEND_PID" "backend" "$BACKEND_LOG"
assert_pid_running "$FRONTEND_PID" "frontend" "$FRONTEND_LOG"

log INFO "Waiting for backend health"
wait_for_http "http://127.0.0.1:${BACKEND_PORT}/api/health" 90
assert_pid_running "$BACKEND_PID" "backend" "$BACKEND_LOG"

log INFO "Waiting for frontend"
wait_for_http "http://127.0.0.1:${FRONTEND_PORT}" 90
assert_pid_running "$FRONTEND_PID" "frontend" "$FRONTEND_LOG"

log INFO "Services are up"
trap - EXIT

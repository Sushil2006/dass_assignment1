#!/usr/bin/env bash
set -Eeuo pipefail

source "$(dirname "$0")/common.sh"
PIDS_FILE="$RUNTIME_DIR/services.pids"

if [[ ! -f "$PIDS_FILE" ]]; then
  exit 0
fi

while read -r pid; do
  [[ -z "$pid" ]] && continue
  if kill -0 "$pid" >/dev/null 2>&1; then
    kill "$pid" >/dev/null 2>&1 || true
  fi
done < "$PIDS_FILE"

sleep 1

while read -r pid; do
  [[ -z "$pid" ]] && continue
  if kill -0 "$pid" >/dev/null 2>&1; then
    kill -9 "$pid" >/dev/null 2>&1 || true
  fi
done < "$PIDS_FILE"

rm -f "$PIDS_FILE"

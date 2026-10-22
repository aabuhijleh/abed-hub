#!/usr/bin/env bash
# Reruns status.sh until no check is running, then prints the settled report.
# Usage: watch.sh [pr-number | pr-url | branch] [--interval s] [--timeout s] [--grace s]
# Exit: 0 settled; 124 checks still running at the timeout; else status.sh's exit.
set -euo pipefail

target=()
interval=30 timeout=1800 grace=60
while (($#)); do
  case $1 in
    --interval) interval=$2 && shift 2 ;;
    --timeout) timeout=$2 && shift 2 ;;
    --grace) grace=$2 && shift 2 ;;
    *) target=("$1") && shift ;;
  esac
done

status=$(dirname "$0")/status.sh
while true; do
  report=$(bash "$status" ${target[@]+"${target[@]}"}) || {
    code=$?
    printf '%s\n' "$report"
    exit "$code"
  }
  # A fresh push shows no checks until GitHub queues them, so zero waits out the grace.
  if ! grep -q "⏳" <<<"$report" && { ! grep -q "✅ 0 passed" <<<"$report" || ((SECONDS >= grace)); }; then
    printf '%s\n' "$report"
    exit 0
  fi
  if ((SECONDS + interval >= timeout)); then
    printf '%s\n' "$report"
    exit 124
  fi
  sleep "$interval"
done

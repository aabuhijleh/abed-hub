#!/usr/bin/env bash
# Prints the files that conflict when merging head into base, one per line; nothing when clean.
# Usage: conflicts.sh <base-ref> <head-ref>
set -uo pipefail

out=$(git merge-tree --write-tree --name-only --no-messages "$1" "$2" 2>/dev/null)
if [[ $? == 1 ]]; then
  tail -n +2 <<<"$out" | sed '/^$/d'
fi

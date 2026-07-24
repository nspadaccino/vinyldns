#!/usr/bin/env bash

set -eo pipefail

ROOT_DIR=$(cd -P -- "$(dirname -- "$0")" && pwd -P)
cd "${ROOT_DIR}"
if [ "$1" == "--interactive" ]; then
  shift
  bash
else
  # Sync dependencies before running - the 'base-test-portal' image ships a
  # pre-baked node_modules that can drift from package.json (e.g. missing
  # jquery-ui-dist / angular-cron-jobs), which makes the first grunt run fail.
  npm install -f --no-audit --no-fund
  grunt unit "$@"
fi

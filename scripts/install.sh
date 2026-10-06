#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export npm_config_cache="${npm_config_cache:-/tmp/company-os-npm}"
export NEXT_TELEMETRY_DISABLED=1
npm ci --no-audit --no-fund
npm run db:migrate
npm run test
npm run build

#!/usr/bin/env bash
# Boots the harness server, runs the iOS conformance runner against it, and
# propagates the runner's exit code. Requires swift (Xcode toolchain).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"


"$PACKAGE_DIR/../../node_modules/.bin/tsx" "$PACKAGE_DIR/bin/serve.ts" > /tmp/voidhash-harness-$$.log 2>&1 &
HARNESS_PID=$!
trap 'kill $HARNESS_PID 2>/dev/null || true' EXIT

for _ in $(seq 1 50); do
  HARNESS_URL="$(grep -o 'HARNESS_READY url=[^ ]*' /tmp/voidhash-harness-$$.log | cut -d= -f2 || true)"
  [ -n "$HARNESS_URL" ] && break
  sleep 0.2
done

if [ -z "${HARNESS_URL:-}" ]; then
  echo "harness server failed to start:" >&2
  cat /tmp/voidhash-harness-$$.log >&2
  exit 1
fi

echo "harness: $HARNESS_URL"
cd "$PACKAGE_DIR/runners/ios"
HARNESS_URL="$HARNESS_URL" swift test

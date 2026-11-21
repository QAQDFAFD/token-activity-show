#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Swift test suite (unit + end-to-end)"
swift test

echo "==> Build app bundle"
./scripts/package_app.sh >/dev/null

TMP="$(mktemp -d "${TMPDIR:-/tmp}/tokenbar-e2e.XXXXXX")"
APP_PID=""
cleanup() {
    if [ -n "$APP_PID" ]; then
        kill "$APP_PID" 2>/dev/null || true
        wait "$APP_PID" 2>/dev/null || true
    fi
    rm -rf "$TMP"
}
trap cleanup EXIT

export TOKENBAR_HOME="$TMP"
export PATH="/usr/bin:/bin:/usr/sbin:/sbin"

echo "==> Packaged app: dump with isolated HOME"
"dist/TokenBar.app/Contents/MacOS/TokenBar" --dump > "$TMP/dump.txt"
grep -q "refreshed in" "$TMP/dump.txt"

echo "==> Packaged app: render preview with isolated HOME"
"dist/TokenBar.app/Contents/MacOS/TokenBar" \
    --preview "$TMP/preview.png" \
    --appearance light \
    --preview-empty >/dev/null
test -s "$TMP/preview.png"

echo "==> Packaged app: render populated menu bar panel"
"dist/TokenBar.app/Contents/MacOS/TokenBar" \
    --preview "$TMP/preview-main.png" \
    --appearance light >/dev/null
test -s "$TMP/preview-main.png"

echo "==> Packaged app: render menu bar settings"
"dist/TokenBar.app/Contents/MacOS/TokenBar" \
    --preview "$TMP/preview-settings.png" \
    --appearance dark \
    --preview-settings >/dev/null
test -s "$TMP/preview-settings.png"

echo "==> Packaged app: menu bar launch smoke"
"dist/TokenBar.app/Contents/MacOS/TokenBar" >"$TMP/app.log" 2>&1 &
APP_PID=$!
sleep 3
if ! kill -0 "$APP_PID" 2>/dev/null; then
    echo "Packaged app exited unexpectedly."
    cat "$TMP/app.log"
    exit 1
fi
kill "$APP_PID" 2>/dev/null || true
wait "$APP_PID" 2>/dev/null || true
APP_PID=""

echo "E2E passed"

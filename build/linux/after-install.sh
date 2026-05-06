#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/trackboi"
CLI_WRAPPER="$APP_DIR/resources/bin/trackboi"
LEGACY_APP_DIR="/opt/Trackboi"
LEGACY_CLI_WRAPPER="$LEGACY_APP_DIR/resources/bin/trackboi"
LEGACY_APP_BINARY="$LEGACY_APP_DIR/trackboi"

if [[ ! -x "$CLI_WRAPPER" ]]; then
	exit 0
fi

if command -v update-alternatives >/dev/null 2>&1; then
	update-alternatives --remove trackboi "$LEGACY_APP_BINARY" >/dev/null 2>&1 || true
	update-alternatives --remove trackboi "$LEGACY_CLI_WRAPPER" >/dev/null 2>&1 || true
	update-alternatives --install /usr/bin/trackboi trackboi "$CLI_WRAPPER" 200 || true
	update-alternatives --set trackboi "$CLI_WRAPPER" || true
else
	ln -sf "$CLI_WRAPPER" /usr/bin/trackboi
fi

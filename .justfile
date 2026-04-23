set shell := ["bash", "--noprofile", "--norc", "-eu", "-o", "pipefail", "-c"]

default:
	@just --list

[private]
assets-brand:
	bun scripts/generate-brand-icons.ts

[private]
dev-ui:
	bunx vite --host 127.0.0.1

[private]
dev-electron-main:
	bunx esbuild src/electron/main.ts --bundle --platform=node --format=cjs --outfile=dist-node/electron/main.cjs --external:electron --watch

[private]
dev-electron-preload:
	bunx esbuild src/electron/preload.ts --bundle --platform=node --format=cjs --outfile=dist-node/electron/preload.cjs --external:electron --watch

dev:
	just assets-brand
	bunx concurrently -k "just dev-ui" "just dev-electron-main" "just dev-electron-preload" "just start-dev-desktop"

[private]
start-dev-desktop:
	bunx wait-on http://127.0.0.1:5173 dist-node/electron/main.cjs dist-node/electron/preload.cjs
	TRACKBOI_DEV_SERVER_URL=http://127.0.0.1:5173 env -u ELECTRON_RUN_AS_NODE bunx electron dist-node/electron/main.cjs

[private]
check-types:
	bunx vue-tsc --noEmit

[private]
check-no-any:
	node scripts/check-no-any.cjs

check:
	just check-types
	just check-no-any

test:
	bun test

test-bench:
	bun test tests/ui/performance.test.ts tests/core/performance.test.ts

test-ui:
	just build
	bunx playwright test

test-ui-headed:
	just build
	bunx playwright test --headed

[private]
build-ui:
	bunx vite build

[private]
build-cli:
	bunx esbuild src/cli/entry.ts --bundle --platform=node --format=cjs --outfile=dist-node/cli/main.cjs

[private]
build-electron:
	just assets-brand
	bunx esbuild src/electron/main.ts --bundle --platform=node --format=cjs --outfile=dist-node/electron/main.cjs --external:electron
	bunx esbuild src/electron/preload.ts --bundle --platform=node --format=cjs --outfile=dist-node/electron/preload.cjs --external:electron

build:
	just build-ui
	just build-cli
	just build-electron

dist:
	just build
	bunx electron-builder --linux --publish never

start:
	env -u ELECTRON_RUN_AS_NODE bunx electron dist-node/electron/main.cjs

mcp-inspect:
	bunx @modelcontextprotocol/inspector bun src/cli/entry.ts mcp

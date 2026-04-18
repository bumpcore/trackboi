#!/usr/bin/env node

import { runCli } from "./main";
import { createNodeFsTrackboiActions } from "../core";

/**
 * Headless Trackboi entrypoint.
 *
 * This file deliberately avoids importing Electron. MCP clients should be able
 * to start Trackboi on stdio from a terminal, service, or editor without a
 * display server and without opening the desktop app.
 */
void runCli(createNodeFsTrackboiActions(), process.argv.slice(2))
	.then((code) => {
		process.exitCode = code;
	})
	.catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});

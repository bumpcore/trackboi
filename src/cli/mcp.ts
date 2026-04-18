import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { NodeFsTrackboiActions } from "../core";
import { registerBoardTools, registerProjectTools } from "./mcp/projectTools";
import { registerCardTools } from "./mcp/cardTools";
import { registerTrackTools } from "./mcp/trackTools";

/**
 * Starts Trackboi's stdio MCP server.
 *
 * The server intentionally talks only to the local Trackboi actions facade; it never reaches
 * into Electron or Vue. That keeps desktop, CLI, and agents on one write path.
 */
export async function runMcpServer(trackboi: NodeFsTrackboiActions): Promise<void> {
	const server = new McpServer({
		name: "trackboi",
		version: "0.1.0",
	});

	registerProjectTools(server, trackboi);
	registerBoardTools(server, trackboi);
	registerCardTools(server, trackboi);
	registerTrackTools(server, trackboi);

	const transport = new StdioServerTransport();
	const closed = new Promise<void>((resolve) => {
		transport.onclose = resolve;
	});
	await server.connect(transport);
	console.error("Trackboi MCP server running on stdio");
	await closed;
}

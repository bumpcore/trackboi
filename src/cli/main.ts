import { Command } from "commander";
import type { NodeFsTrackboiActions } from "../core";
import { installTrackboi, type InstallOptions } from "./install";
import { runMcpServer } from "./mcp";

const CLI_COMMANDS = new Set(["install", "mcp", "help", "--help", "-h"]);

export function findCliArgs(argv: string[]): string[] {
	const startIndex = argv.findIndex((arg) => CLI_COMMANDS.has(arg));
	return startIndex >= 0 ? argv.slice(startIndex) : [];
}

/**
 * Runs command-line Trackboi commands without opening the desktop window.
 *
 * The MCP server will enter here too, which keeps agent and human CLI commands
 * on the same shared core as the desktop app.
 */
export async function runCli(trackboi: NodeFsTrackboiActions, argv: string[]): Promise<number> {
	let exitCode = 0;
	const program = new Command();

	program
		.name("trackboi")
		.description("Local-first task tracking with a desktop app and MCP server.")
		.showHelpAfterError()
		.exitOverride((error) => {
			throw error;
		});

	program
		.command("mcp")
		.description("Run the stdio MCP server.")
		.action(async () => {
			await runMcpServer(trackboi);
		});

	program
		.command("install")
		.description("Install Trackboi agent integrations into the current project.")
		.option("--mcp", "Install a project-local .mcp.json entry for trackboi mcp.")
		.option("--skill", "Install the Trackboi Codex skill under .agents/skills/trackboi.")
		.option("--agents", "Install or update AGENTS.md with Trackboi guidance.")
		.option("--agent", "Alias for --agents.")
		.option("--all", "Install MCP config, skill, and AGENTS.md guidance.")
		.option("--target <path>", "Project root to install into.", process.cwd())
		.option("--force", "Replace invalid install config files when safe.")
		.action((options: InstallOptions & { agent?: boolean; target?: string }) => {
			const result = installTrackboi({
				...options,
				agents: options.agents === true || options.agent === true,
				targetDir: options.target,
			});
			console.log(`Installed Trackboi integrations in ${result.targetDir}`);
			for (const item of result.installed) console.log(`+ ${item}`);
			for (const item of result.skipped) console.log(`= ${item} already configured`);
		});

	if (argv.length === 0) {
		program.help({ error: false });
		return 0;
	}

	try {
		await program.parseAsync(argv, { from: "user" });
	} catch (error: unknown) {
		if (isCommanderExit(error)) {
			exitCode = error.exitCode;
		} else {
			console.error(error instanceof Error ? error.message : String(error));
			exitCode = 1;
		}
	}

	return exitCode;
}

export function isCliCommand(command: string | undefined): boolean {
	return command !== undefined && CLI_COMMANDS.has(command);
}

export async function runCliCommand(trackboi: NodeFsTrackboiActions, command: string, args: string[]): Promise<number> {
	if (command === "mcp") {
		await runMcpServer(trackboi);
		return 0;
	}

	return runCli(trackboi, [command, ...args]);
}

function isCommanderExit(error: unknown): error is { exitCode: number } {
	return typeof error === "object" && error !== null && "exitCode" in error;
}

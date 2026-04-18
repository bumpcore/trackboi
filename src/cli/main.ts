import { Command } from "commander";
import type { NodeFsTrackboiActions, ProjectSource, ProjectView } from "../core";
import { runMcpServer } from "./mcp";

const CLI_COMMANDS = new Set(["cards", "projects", "mcp", "help", "--help", "-h"]);

export function findCliArgs(argv: string[]): string[] {
	const startIndex = argv.findIndex((arg) => CLI_COMMANDS.has(arg));
	return startIndex >= 0 ? argv.slice(startIndex) : [];
}

type CardsOptions = {
	json?: boolean;
};

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
		.command("projects")
		.description("List projects Trackboi can see.")
		.action(async () => {
			await printProjects(trackboi);
		});

	program
		.command("cards")
		.description("List cards for the active project.")
		.option("--json", "Print cards as JSON.")
		.action(async (options: CardsOptions) => {
			await printCards(trackboi, options);
		});

	program
		.command("mcp")
		.description("Run the stdio MCP server.")
		.action(async () => {
			await runMcpServer(trackboi);
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

async function printProjects(trackboi: NodeFsTrackboiActions): Promise<void> {
	const view = await trackboi.listView();
	if (view.sources.every((source) => source.entries.length === 0)) {
		console.log("No projects registered.");
		return;
	}

	for (const source of view.sources) {
		printProjectSource(source, view);
	}
}

function printProjectSource(source: ProjectSource, view: ProjectView): void {
	if (source.entries.length === 0) return;
	console.log(source.label);
	for (const entry of source.entries) {
		const active = entry.projectId === view.activeProjectId ? "*" : " ";
		console.log(`${active} ${entry.name}  ${entry.status}  ${entry.path}`);
	}
}

async function printCards(trackboi: NodeFsTrackboiActions, options: CardsOptions): Promise<void> {
	const json = options.json === true;
	const snapshot = await trackboi.getActiveProject();
	if (!snapshot) {
		if (json) console.log("[]");
		else console.log("No active project.");
		return;
	}

	if (json) {
		console.log(JSON.stringify(snapshot.cards, null, "\t"));
		return;
	}

	console.log(`${snapshot.project.name} (${snapshot.cards.length} cards)`);
	for (const card of snapshot.cards) {
		const scope = card.scope.kind === "track" ? card.scope.ref : "global";
		const parent = card.parentId ? ` parent:${card.parentId}` : "";
		console.log(`- ${card.id} [${card.column}] [${scope}] ${card.title}${parent}`);
	}
}

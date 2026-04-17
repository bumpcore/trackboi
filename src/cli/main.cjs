const CLI_COMMANDS = new Set(["cards", "projects", "mcp", "help", "--help", "-h"]);

function findCliArgs(argv) {
	const startIndex = argv.findIndex((arg) => CLI_COMMANDS.has(arg));
	return startIndex >= 0 ? argv.slice(startIndex) : [];
}

async function runCli(runtime, argv) {
	const [command, ...args] = argv;

	if (!command || command === "help" || command === "--help" || command === "-h") {
		printHelp();
		return 0;
	}

	if (command === "projects") {
		printProjects(runtime);
		return 0;
	}

	if (command === "cards") {
		printCards(runtime, args);
		return 0;
	}

	if (command === "mcp") {
		console.error("Trackboi MCP stdio server is not wired yet.");
		console.error("The command dispatch exists now; next cut plugs MCP into the shared core.");
		return 1;
	}

	console.error(`Unknown command: ${command}`);
	printHelp();
	return 1;
}

function printHelp() {
	console.log(`trackboi

Usage:
  trackboi                 Open the desktop app
  trackboi projects        List projects Trackboi can see
  trackboi cards           List cards for the active project
  trackboi mcp             Run the stdio MCP server (coming next)
`);
}

function printProjects(runtime) {
	const view = runtime.listView();
	if (view.sources.every((source) => source.entries.length === 0)) {
		console.log("No projects registered.");
		return;
	}

	for (const source of view.sources) {
		if (source.entries.length === 0) continue;
		console.log(`${source.label}`);
		for (const entry of source.entries) {
			const active = entry.projectId === view.activeProjectId ? "*" : " ";
			console.log(`${active} ${entry.name}  ${entry.status}  ${entry.path}`);
		}
	}
}

function printCards(runtime, args) {
	const json = args.includes("--json");
	const snapshot = runtime.activeSnapshot();
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
		const scope = card.scope.kind === "branch" ? card.scope.ref : "global";
		const parent = card.parentId ? ` parent:${card.parentId}` : "";
		console.log(`- ${card.id} [${card.column}] [${scope}] ${card.title}${parent}`);
	}
}

module.exports = {
	findCliArgs,
	runCli,
};

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.join(ROOT, "src");
const EXTENSIONS = new Set([".ts", ".vue"]);
const IGNORED_DIRS = new Set(["node_modules", "dist", "dist-node", "build"]);

const offenders = [];

walk(SOURCE_ROOT);

if (offenders.length > 0) {
	console.error("Explicit `any` is not allowed in Trackboi TypeScript.");
	for (const offender of offenders) {
		console.error(`${offender.file}:${offender.line}:${offender.column} ${offender.text.trim()}`);
	}
	process.exit(1);
}

function walk(currentPath) {
	const stat = fs.statSync(currentPath);
	if (stat.isDirectory()) {
		if (IGNORED_DIRS.has(path.basename(currentPath))) return;
		for (const child of fs.readdirSync(currentPath)) {
			walk(path.join(currentPath, child));
		}
		return;
	}

	if (!EXTENSIONS.has(path.extname(currentPath))) return;
	checkFile(currentPath);
}

function checkFile(filePath) {
	const relativePath = path.relative(ROOT, filePath);
	const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
	for (const [index, line] of lines.entries()) {
		const column = findExplicitAnyColumn(line);
		if (column == null) continue;
		offenders.push({
			file: relativePath,
			line: index + 1,
			column,
			text: line,
		});
	}
}

function findExplicitAnyColumn(line) {
	const patterns = [
		/\bany\b/,
	];

	for (const pattern of patterns) {
		const match = pattern.exec(line);
		if (match?.index != null) return match.index + 1;
	}

	return null;
}

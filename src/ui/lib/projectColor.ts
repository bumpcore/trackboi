import type { ProjectEntry, ProjectSnapshot } from "@/core/types";

export type ProjectColorSource = (Pick<ProjectEntry, "name" | "path"> | Pick<ProjectSnapshot["project"], "name" | "path">) & {
	color?: string | null;
} | null;

const PROJECT_PALETTE = [
	{ bg: "hsl(211 88% 56%)", fg: "hsl(0 0% 100%)" },
	{ bg: "hsl(38 92% 52%)", fg: "hsl(0 0% 6%)" },
	{ bg: "hsl(168 78% 39%)", fg: "hsl(0 0% 100%)" },
	{ bg: "hsl(348 78% 58%)", fg: "hsl(0 0% 100%)" },
	{ bg: "hsl(24 88% 55%)", fg: "hsl(0 0% 6%)" },
	{ bg: "hsl(187 76% 44%)", fg: "hsl(0 0% 100%)" },
];

export function projectColorStyle(source: ProjectColorSource) {
	const seed = `${source?.name ?? "trackboi"}:${source?.path ?? ""}`;
	const color = PROJECT_PALETTE[hashString(seed) % PROJECT_PALETTE.length] ?? PROJECT_PALETTE[0];
	return {
		"--project-color": source?.color ?? color.bg,
		"--project-fg": color.fg,
	};
}

function hashString(value: string) {
	let hash = 0;
	for (const char of value) {
		hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	}
	return hash;
}

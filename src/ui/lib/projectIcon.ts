import type { ProjectEntry, ProjectSnapshot, WorktreeContext } from "@/core/types";

export type ProjectIconSource = (
	| Pick<ProjectEntry, "iconPath">
	| Pick<ProjectSnapshot["metadata"], "iconPath">
	| Pick<WorktreeContext, "iconPath">
) | null;

/**
 * Converts a persisted local image path into a renderer-safe image URL.
 */
export function projectIconSrc(source: ProjectIconSource): string | null {
	const iconPath = source?.iconPath?.trim();
	if (!iconPath) return null;
	if (/^(file|https?):\/\//i.test(iconPath) || iconPath.startsWith("data:")) return iconPath;
	if (iconPath.startsWith("/")) return `file://${encodeURI(iconPath)}`;
	return encodeURI(iconPath);
}

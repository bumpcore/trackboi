/**
 * Normalizes a user-entered track document name to the markdown-only storage
 * shape enforced by core.
 */
export function normalizeTrackDocName(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return "";
	return trimmed.toLowerCase().endsWith(".md") ? trimmed : `${trimmed}.md`;
}

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Reads a JSON file and trusts the caller-provided type.
 *
 * Runtime schema validation belongs here eventually. For now this centralizes
 * the one unavoidable cast instead of scattering unsafe parsing through core.
 */
export function readJson<T>(filePath: string): T {
	return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

/**
 * Writes JSON through a sibling temp file and rename.
 *
 * Rename is atomic on the same filesystem, which prevents half-written card or
 * board files when Trackboi is interrupted mid-write.
 */
export function writeJsonAtomic<T>(filePath: string, value: T): void {
	mkdirSync(dirname(filePath), { recursive: true });
	const tempPath = `${filePath}.tmp`;
	writeFileSync(tempPath, `${JSON.stringify(value, null, "\t")}\n`);
	renameSync(tempPath, filePath);
}

export function jsonEquals(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

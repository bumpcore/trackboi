import { ulid } from "ulid";

/**
 * Creates a locally unique, readable id for persisted Trackboi files.
 *
 * The id is intentionally prefixed because card/project files should be easy to
 * recognize in git diffs and CLI output.
 */
export function newId(prefix: string): string {
	return `${prefix}_${ulid()}`;
}

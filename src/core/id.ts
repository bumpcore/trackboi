import { ulid } from "ulid";

/**
 * Creates a locally unique id for persisted Trackboi records.
 *
 * Entity types are already known from storage location and API context, so new
 * ids avoid redundant type prefixes. Mixed references should carry type in the
 * reference value itself, for example `agent:01K...`.
 */
export function newId(_prefix: string): string {
	return ulid();
}

export function slugifyIdPart(value: string, fallback: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 48) || fallback;
}

/**
 * Creates a stable, filesystem-friendly id for user-facing repo storage.
 *
 * The title part makes git diffs and folder browsing humane, while the random
 * suffix keeps ids safe for distributed local writes without central counters.
 */
export function newSlugId(_prefix: string, title: string): string {
	const suffix = randomSuffix();
	return `${slugifyIdPart(title, "item")}-${suffix}`;
}

function randomSuffix(): string {
	const bytes = new Uint8Array(4);
	if (typeof globalThis.crypto?.getRandomValues === "function") {
		globalThis.crypto.getRandomValues(bytes);
	} else {
		for (let index = 0; index < bytes.length; index += 1) {
			bytes[index] = Math.floor(Math.random() * 256);
		}
	}
	let value = 0;
	for (const byte of bytes) value = ((value << 8) | byte) >>> 0;
	return value.toString(36).padStart(7, "0").slice(0, 7);
}

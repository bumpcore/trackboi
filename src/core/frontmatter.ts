/**
 * Keeps the markdown storage format simple and git-friendly by treating front
 * matter as a flat key/value map with JSON-encoded values where needed.
 */
export function parseFrontmatter<T extends Record<string, unknown>>(input: string): { data: T; body: string } {
	const normalizedInput = input.replace(/\r\n/g, "\n");
	if (!normalizedInput.startsWith("---\n")) {
		return { data: {} as T, body: normalizedInput };
	}

	const endIndex = normalizedInput.indexOf("\n---\n", 4);
	if (endIndex === -1) {
		return { data: {} as T, body: normalizedInput };
	}

	const rawFrontmatter = normalizedInput.slice(4, endIndex);
	const body = normalizedInput.slice(endIndex + 5);
	const data = Object.create(null) as Record<string, unknown>;

	for (const line of rawFrontmatter.split("\n")) {
		if (!line.trim()) continue;
		const separatorIndex = line.indexOf(":");
		if (separatorIndex <= 0) continue;
		const key = line.slice(0, separatorIndex).trim();
		const rawValue = line.slice(separatorIndex + 1).trim();
		data[key] = parseFrontmatterValue(rawValue);
	}

	return { data: data as T, body };
}

export function writeFrontmatter<T extends Record<string, unknown>>(data: T, body: string): string {
	const lines = Object.entries(data)
		.filter(([, value]) => value !== undefined)
		.map(([key, value]) => `${key}: ${serializeFrontmatterValue(value)}`);
	const normalizedBody = body.replace(/\r\n/g, "\n");
	return `---\n${lines.join("\n")}\n---\n${normalizedBody}`;
}

function parseFrontmatterValue(rawValue: string): unknown {
	if (rawValue.length === 0) return "";
	try {
		return JSON.parse(rawValue);
	} catch {
		return rawValue;
	}
}

function serializeFrontmatterValue(value: unknown): string {
	if (typeof value === "string") return JSON.stringify(value);
	return JSON.stringify(value);
}

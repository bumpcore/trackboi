import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import { findCliArgs, isCliCommand } from "../../src/cli/main";
import { installTrackboi } from "../../src/cli/install";

describe("trackboi install", () => {
	test("installs mcp, skill, and agent guide by default", () => {
		const root = mkdtempSync(path.join(os.tmpdir(), "trackboi-install-"));
		const result = installTrackboi({ targetDir: root });

		expect(result.installed).toContain(".mcp.json");
		expect(result.installed).toContain(".agents/skills/trackboi");
		expect(result.installed).toContain("AGENTS.md");

		const mcpConfig = JSON.parse(readFileSync(path.join(root, ".mcp.json"), "utf8"));
		expect(mcpConfig.mcpServers.trackboi).toEqual({
			command: "trackboi",
			args: ["mcp"],
		});
		expect(readFileSync(path.join(root, ".agents", "skills", "trackboi", "SKILL.md"), "utf8")).toContain("Use Trackboi when the work is more than a tiny one-shot answer");
		expect(readFileSync(path.join(root, "AGENTS.md"), "utf8")).toContain(".agents/skills/trackboi/SKILL.md");
	});

	test("can install only selected integrations", () => {
		const root = mkdtempSync(path.join(os.tmpdir(), "trackboi-install-"));
		const result = installTrackboi({ targetDir: root, mcp: true });

		expect(result.installed).toEqual([".mcp.json"]);
		expect(readFileSync(path.join(root, ".mcp.json"), "utf8")).toContain("\"trackboi\"");
	});

	test("preserves existing mcp servers", () => {
		const root = mkdtempSync(path.join(os.tmpdir(), "trackboi-install-"));
		writeFileSync(path.join(root, ".mcp.json"), JSON.stringify({
			mcpServers: {
				other: {
					command: "other",
					args: [],
				},
			},
		}), "utf8");

		installTrackboi({ targetDir: root, mcp: true });
		const mcpConfig = JSON.parse(readFileSync(path.join(root, ".mcp.json"), "utf8"));

		expect(mcpConfig.mcpServers.other.command).toBe("other");
		expect(mcpConfig.mcpServers.trackboi.command).toBe("trackboi");
	});
});

describe("trackboi cli command detection", () => {
	test("only install and mcp are public cli commands", () => {
		expect(isCliCommand("install")).toBe(true);
		expect(isCliCommand("mcp")).toBe(true);
		expect(isCliCommand("cards")).toBe(false);
		expect(isCliCommand("projects")).toBe(false);
		expect(findCliArgs(["--foo", "install", "--skill"])).toEqual(["install", "--skill"]);
	});
});

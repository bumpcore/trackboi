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
		const skillText = readFileSync(path.join(root, ".agents", "skills", "trackboi", "SKILL.md"), "utf8");
		expect(skillText).toContain("# trackboi 101 for agents");
		expect(skillText).toContain("trackboi is a local-first workbench for repo-bound work");
		expect(skillText).toContain("orient_agent");
		expect(skillText).toContain("`.trackboi`, `.etc/.trackboi`, then `.etc/trackboi`");
		expect(skillText).toContain("Never manually create, update, move, or delete trackboi records in the filesystem");
		const agentsGuide = readFileSync(path.join(root, "AGENTS.md"), "utf8");
		expect(agentsGuide).toContain("<trackboi>");
		expect(agentsGuide).toContain("When trackboi MCP tools are available");
		expect(agentsGuide).toContain("Do not manually create, update, or delete trackboi records in the filesystem");
		expect(agentsGuide).toContain("</trackboi>");
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

	test("updates an existing managed AGENTS.md trackboi block", () => {
		const root = mkdtempSync(path.join(os.tmpdir(), "trackboi-install-"));
		writeFileSync(path.join(root, "AGENTS.md"), [
			"# Agent Guide",
			"",
			"Keep this repository-specific rule.",
			"",
			"<trackboi>",
			"old trackboi instructions",
			"</trackboi>",
			"",
			"Keep this too.",
			"",
		].join("\n"), "utf8");

		const result = installTrackboi({ targetDir: root, agents: true });
		const agentsGuide = readFileSync(path.join(root, "AGENTS.md"), "utf8");

		expect(result.installed).toEqual(["AGENTS.md"]);
		expect(agentsGuide).toContain("Keep this repository-specific rule.");
		expect(agentsGuide).toContain("Keep this too.");
		expect(agentsGuide).toContain("<trackboi>");
		expect(agentsGuide).toContain("When trackboi MCP tools are available");
		expect(agentsGuide).toContain("Do not manually create, update, or delete trackboi records in the filesystem");
		expect(agentsGuide).not.toContain("old trackboi instructions");
		expect(agentsGuide.match(/<trackboi>/g)?.length).toBe(1);
	});

	test("wraps current unmarked AGENTS.md trackboi guidance into a managed block", () => {
		const root = mkdtempSync(path.join(os.tmpdir(), "trackboi-install-"));
		writeFileSync(path.join(root, "AGENTS.md"), [
			"# Agent Guide",
			"",
			"## trackboi Skill",
			"",
			"When trackboi MCP tools are available, agents can load `.agents/skills/trackboi/SKILL.md` for details, then call `orient_agent` to catch up before updating cards, tracks, boards, or handoff notes. If `.trackboi`, `.etc/.trackboi`, or `.etc/trackboi` files are present but MCP tools are not available, agents may read those files to catch up on local context. Do not manually create, update, or delete trackboi records in the filesystem; use MCP tools for mutations.",
			"",
		].join("\n"), "utf8");

		installTrackboi({ targetDir: root, agents: true });
		const agentsGuide = readFileSync(path.join(root, "AGENTS.md"), "utf8");

		expect(agentsGuide).toContain("<trackboi>");
		expect(agentsGuide).toContain("</trackboi>");
		expect(agentsGuide).toContain("When trackboi MCP tools are available");
		expect(agentsGuide.match(/## trackboi Skill/g)?.length).toBe(1);
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

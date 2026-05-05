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
		expect(skillText).toContain("Use trackboi when the work is more than a tiny one-shot answer");
		expect(skillText).toContain("`.trackboi`, `.etc/.trackboi`, then `.etc/trackboi`");
		const agentsGuide = readFileSync(path.join(root, "AGENTS.md"), "utf8");
		expect(agentsGuide).toContain("<trackboi>");
		expect(agentsGuide).toContain(".agents/skills/trackboi/SKILL.md");
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
		expect(agentsGuide).toContain(".agents/skills/trackboi/SKILL.md");
		expect(agentsGuide).not.toContain("old trackboi instructions");
		expect(agentsGuide.match(/<trackboi>/g)?.length).toBe(1);
	});

	test("migrates legacy unmarked AGENTS.md trackboi guidance into a managed block", () => {
		const root = mkdtempSync(path.join(os.tmpdir(), "trackboi-install-"));
		writeFileSync(path.join(root, "AGENTS.md"), [
			"# Agent Guide",
			"",
			"## trackboi Skill",
			"",
			"Agents working in this repository should load `.agents/skills/trackboi/SKILL.md` when work is non-trivial, stateful, or useful to track beyond the current chat. Use trackboi MCP tools when available to orient, choose the active project/worktree/board, update cards, and leave handoff notes.",
			"",
		].join("\n"), "utf8");

		installTrackboi({ targetDir: root, agents: true });
		const agentsGuide = readFileSync(path.join(root, "AGENTS.md"), "utf8");

		expect(agentsGuide).toContain("<trackboi>");
		expect(agentsGuide).toContain("</trackboi>");
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

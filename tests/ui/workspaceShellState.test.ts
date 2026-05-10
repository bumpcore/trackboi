import { describe, expect, test } from "bun:test";
import { useWorkspaceShellState } from "../../src/ui/composables/useWorkspaceShellState";

describe("workspace shell state", () => {
	test("can switch the right view without revealing a collapsed panel", () => {
		const shell = useWorkspaceShellState();
		shell.rightCollapsed.value = true;

		shell.setRightView("track", { reveal: false });

		expect(shell.rightView.value).toBe("track");
		expect(shell.rightCollapsed.value).toBe(true);

		shell.setRightView("card");

		expect(shell.rightView.value).toBe("card");
		expect(shell.rightCollapsed.value).toBe(false);
	});
});

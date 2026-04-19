import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/ui/e2e",
	testMatch: "**/*.e2e.ts",
	timeout: 60_000,
	expect: {
		timeout: 10_000,
	},
	workers: 1,
	reporter: [["list"]],
	use: {
		testIdAttribute: "data-testid",
	},
});

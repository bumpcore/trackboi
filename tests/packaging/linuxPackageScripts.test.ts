import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
	build: {
		deb?: { afterInstall?: string };
		rpm?: { afterInstall?: string };
	};
};

const afterInstallScript = readFileSync(new URL("../../build/linux/after-install.sh", import.meta.url), "utf8");

describe("linux package scripts", () => {
	test("deb and rpm packages repair the global trackboi command with the shared hook", () => {
		expect(packageJson.build.deb?.afterInstall).toBe("build/linux/after-install.sh");
		expect(packageJson.build.rpm?.afterInstall).toBe("build/linux/after-install.sh");
	});

	test("after install hook points the trackboi command at the packaged CLI wrapper", () => {
		expect(afterInstallScript).toContain('APP_DIR="/opt/trackboi"');
		expect(afterInstallScript).toContain('CLI_WRAPPER="$APP_DIR/resources/bin/trackboi"');
		expect(afterInstallScript).toContain('LEGACY_APP_DIR="/opt/Trackboi"');
		expect(afterInstallScript).toContain("update-alternatives --install /usr/bin/trackboi trackboi \"$CLI_WRAPPER\"");
		expect(afterInstallScript).not.toContain('CLI_WRAPPER="/opt/Trackboi');
	});
});

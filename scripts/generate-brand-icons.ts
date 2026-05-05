import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceSvgPath = path.join(rootDir, "trackboi.svg");
const buildDir = path.join(rootDir, "build");
const iconsDir = path.join(buildDir, "icons");
const iconSizes = [16, 24, 32, 48, 64, 128, 256, 512];
const imageMagickCommand = ["magick", "convert"].find((command) => {
	const result = spawnSync(command, ["--version"], { stdio: "ignore" });
	return result.status === 0;
});

if (!imageMagickCommand) {
	throw new Error("ImageMagick is required to generate app icons. Install `magick` or `convert`.");
}

mkdirSync(iconsDir, { recursive: true });
copyFileSync(sourceSvgPath, path.join(buildDir, "icon.svg"));
copyFileSync(sourceSvgPath, path.join(iconsDir, "trackboi.svg"));

for (const size of iconSizes) {
	const outputPath = path.join(iconsDir, `${size}x${size}.png`);
	const result = spawnSync(
		imageMagickCommand,
		["-background", "none", "-density", "512", sourceSvgPath, "-resize", `${size}x${size}`, outputPath],
		{ encoding: "utf8" },
	);

	if (result.status !== 0) {
		throw new Error(result.stderr.trim() || `Failed to generate ${outputPath}`);
	}
}

copyFileSync(path.join(iconsDir, "512x512.png"), path.join(buildDir, "icon.png"));

import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceSvgPath = path.join(rootDir, "trackboi.svg");
const buildDir = path.join(rootDir, "build");
const iconsDir = path.join(buildDir, "icons");
const iconSizes = [16, 24, 32, 48, 64, 128, 256, 512];

mkdirSync(iconsDir, { recursive: true });
copyFileSync(sourceSvgPath, path.join(buildDir, "icon.svg"));
copyFileSync(sourceSvgPath, path.join(iconsDir, "trackboi.svg"));

for (const size of iconSizes) {
	const outputPath = path.join(iconsDir, `${size}x${size}.png`);
	await Bun.$`magick -background none -density 512 ${sourceSvgPath} -resize ${size}x${size} ${outputPath}`.quiet();
}

copyFileSync(path.join(iconsDir, "512x512.png"), path.join(buildDir, "icon.png"));

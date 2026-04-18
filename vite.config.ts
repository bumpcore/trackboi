import path from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	plugins: [vue(), tailwindcss()],
	root: "src/ui",
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	build: {
		outDir: "../../dist",
		emptyOutDir: true,
		target: "esnext",
	},
	server: {
		port: 5173,
		strictPort: true,
	},
});

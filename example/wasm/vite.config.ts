import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const repoRoot = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"@zendrex/buttplug.js/wasm": repoRoot("src/wasm/index.ts"),
			"@zendrex/buttplug.js": repoRoot("src/index.ts"),
		},
	},
	server: {
		port: 5173,
	},
	optimizeDeps: {
		include: ["buttplug-wasm-blob"],
	},
});

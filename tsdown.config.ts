import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts", "src/patterns/index.ts", "src/wasm/index.ts"],
	format: ["esm", "cjs"],
	dts: true,
	clean: true,
	target: false,
	external: ["buttplug-wasm-blob"],
});

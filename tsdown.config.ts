import { defineConfig } from "tsdown";

export default defineConfig([{
	entry: ["src/index.ts", "src/patterns/index.ts", "src/wasm/index.ts"],
	format: ["esm", "cjs"],
	dts: true,
	clean: true,
	target: false,
	external: ["buttplug-wasm-blob"],
},
// Browser builds – inline dependencies
{
	// While this build bundles the dependencies it still produces a features-*.mjs file,
	// see https://github.com/rolldown/tsdown/issues/760
	entry: ['src/index.ts', 'src/patterns/index.ts'],
	outDir: 'dist/browser',
	format: ['esm'],
	dts: false,
	// Override tsdown's default "externalize dependencies" behavior
	deps: {
		onlyBundle: ['emittery', 'zod'],
		alwaysBundle: ['emittery', 'zod'],
	},
	minify: true,
},
{
	entry: ['src/index.ts'],
	outDir: 'dist/browser',
	format: ['iife'],
	globalName: 'Buttplug',
	dts: false,
	// Override tsdown's default "externalize dependencies" behavior
	deps: {
		onlyBundle: ['emittery', 'zod'],
		alwaysBundle: ['emittery', 'zod'],
	},
	outputOptions: {
		codeSplitting: false,
	},
	minify: true,
},
{
	entry: ['src/patterns/index.ts'],
	outDir: 'dist/browser/patterns',
	format: ['iife'],
	globalName: 'ButtplugPatterns',
	dts: false,
	// Override tsdown's default "externalize dependencies" behavior
	deps: {
		onlyBundle: ['zod'],
		alwaysBundle: ['zod'],
	},
	outputOptions: {
		codeSplitting: false,
	},
	minify: true,
},]);

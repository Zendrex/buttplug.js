import { resolve } from "node:path";

import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

const basePath = "/buttplug.js";

const repoSrc = (subpath) => resolve(import.meta.dirname, `../src/${subpath}`);

/** Resolve the library from source so the docs site does not require a separate dist build. */
const libraryAliases = {
	"@zendrex/buttplug.js/wasm": repoSrc("wasm/index.ts"),
	"@zendrex/buttplug.js": repoSrc("index.ts"),
};

/** Turbopack requires project-relative aliases (not absolute paths). */
const turbopackLibraryAliases = {
	"@zendrex/buttplug.js/wasm": "../src/wasm/index.ts",
	"@zendrex/buttplug.js": "../src/index.ts",
};

/** @type {import('next').NextConfig} */
const config = {
	output: "export",
	basePath,
	env: {
		NEXT_PUBLIC_BASE_PATH: basePath,
	},
	reactStrictMode: true,
	turbopack: {
		resolveAlias: turbopackLibraryAliases,
	},
	webpack: (config) => {
		config.resolve.alias = {
			...config.resolve.alias,
			...libraryAliases,
		};
		config.resolve.modules = [
			resolve(import.meta.dirname, "node_modules"),
			...(config.resolve.modules ?? ["node_modules"]),
		];
		return config;
	},
};

export default withMDX(config);

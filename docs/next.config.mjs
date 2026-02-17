import { resolve } from "node:path";

import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

const basePath = "/buttplug.js";

/** @type {import('next').NextConfig} */
const config = {
	output: "export",
	basePath,
	env: {
		NEXT_PUBLIC_BASE_PATH: basePath,
	},
	reactStrictMode: true,
	webpack: (config) => {
		config.resolve.modules = [
			resolve(import.meta.dirname, "node_modules"),
			...(config.resolve.modules ?? ["node_modules"]),
		];
		return config;
	},
};

export default withMDX(config);

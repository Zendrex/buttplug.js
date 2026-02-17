import path from "node:path";

import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { remarkAutoTypeTable } from "fumadocs-typescript";

export const docs = defineDocs({
	dir: "content/docs",
	docs: {
		postprocess: {
			includeProcessedMarkdown: true,
		},
	},
});

export default defineConfig({
	mdxOptions: {
		remarkPlugins: [
			[
				remarkAutoTypeTable,
				{
					options: {
						basePath: path.resolve(".."),
					},
				},
			],
		],
	},
});

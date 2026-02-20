import { source } from "@/lib/source";

export const revalidate = false;

export function GET(): Response {
	const pages = source.getPages();

	const lines = [
		"# buttplug.js",
		"",
		"> TypeScript client for the Buttplug Intimacy Protocol v4",
		"",
		"## Pages",
		"",
	];

	for (const page of pages) {
		const title = page.data.title;
		const description = page.data.description ?? "";
		const url = page.url;
		lines.push(`- [${title}](${url})${description ? `: ${description}` : ""}`);
	}

	return new Response(lines.join("\n"), {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}

import { source } from "@/lib/source";

export const revalidate = false;

export async function GET(): Promise<Response> {
	const pages = source.getPages();
	const sections: string[] = [];

	for (const page of pages) {
		const title = page.data.title;
		const description = page.data.description ?? "";
		const content = await page.data.getText("processed");

		const section = [`# ${title}`, description ? `\n> ${description}` : "", "", content].join("\n");

		sections.push(section);
	}

	return new Response(sections.join("\n\n---\n\n"), {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}

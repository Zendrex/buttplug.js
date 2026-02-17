import type { Metadata } from "next";

import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import { notFound, redirect } from "next/navigation";

import { CopyMarkdownButton } from "@/components/copy-markdown-button";
import { source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";

export default async function Page(props: PageProps<"/docs/[[...slug]]">) {
	const params = await props.params;
	if (!params.slug || params.slug.length === 0) {
		redirect("/docs/client");
	}

	const page = source.getPage(params.slug);
	if (!page) {
		notFound();
	}

	const markdown = await page.data.getText("processed");
	const MDX = page.data.body;

	return (
		<DocsPage full={page.data.full} toc={page.data.toc}>
			<DocsTitle>{page.data.title}</DocsTitle>
			<DocsDescription>{page.data.description}</DocsDescription>
			<CopyMarkdownButton markdown={markdown} />
			<hr className="my-2" />
			<DocsBody>
				<MDX
					components={getMDXComponents({
						a: createRelativeLink(source, page),
					})}
				/>
			</DocsBody>
		</DocsPage>
	);
}

export async function generateStaticParams() {
	return [{ slug: [] }, ...(await source.generateParams())];
}

export async function generateMetadata(props: PageProps<"/docs/[[...slug]]">): Promise<Metadata> {
	const params = await props.params;
	if (!params.slug || params.slug.length === 0) {
		return { title: "Documentation" };
	}

	const page = source.getPage(params.slug);
	if (!page) {
		notFound();
	}

	return {
		title: page.data.title,
		description: page.data.description,
	};
}

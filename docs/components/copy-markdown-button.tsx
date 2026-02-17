"use client";

import { useCopyButton } from "fumadocs-ui/utils/use-copy-button";
import { Check, Copy } from "lucide-react";

export function CopyMarkdownButton({ markdown }: { markdown: string }) {
	const [checked, onClick] = useCopyButton(() => navigator.clipboard.writeText(markdown));

	return (
		<button
			className="inline-flex w-fit items-center gap-1.5 rounded-md bg-fd-secondary px-3 py-1.5 font-medium text-fd-secondary-foreground text-xs transition-colors hover:bg-fd-accent"
			onClick={onClick}
			type="button"
		>
			{checked ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
			{checked ? "Copied!" : "Copy Markdown"}
		</button>
	);
}

import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { AudioWaveform, Cable } from "lucide-react";

import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

export default function Layout({ children }: LayoutProps<"/docs">) {
	return (
		<DocsLayout
			tree={source.getPageTree()}
			{...baseOptions()}
			sidebar={{
				tabs: {
					transform(option, _node) {
						if (option.url === "/docs/client") {
							return { ...option, icon: <Cable /> };
						}
						if (option.url === "/docs/patterns") {
							return { ...option, icon: <AudioWaveform /> };
						}
						return option;
					},
				},
			}}
		>
			{children}
		</DocsLayout>
	);
}

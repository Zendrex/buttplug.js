"use client";

import { useCopyButton } from "fumadocs-ui/utils/use-copy-button";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

const managers = [
	{ name: "bun", command: "bun add @zendrex/buttplug.js" },
	{ name: "npm", command: "npm install @zendrex/buttplug.js" },
	{ name: "yarn", command: "yarn add @zendrex/buttplug.js" },
	{ name: "pnpm", command: "pnpm add @zendrex/buttplug.js" },
] as const;

export function InstallTabs() {
	const [active, setActive] = useState(0);
	const current = managers[active];
	const [checked, onCopy] = useCopyButton(() => navigator.clipboard.writeText(current.command));

	return (
		<div className="w-full max-w-lg overflow-hidden rounded-xl border border-fd-border bg-fd-card">
			<div className="flex items-center border-fd-border border-b">
				{managers.map((manager, index) => (
					<button
						className={`px-4 py-2.5 font-medium text-sm transition-colors ${
							index === active
								? "bg-fd-background text-fd-foreground"
								: "text-fd-muted-foreground hover:text-fd-foreground"
						}`}
						key={manager.name}
						onClick={() => setActive(index)}
						type="button"
					>
						{manager.name}
					</button>
				))}
				<div className="flex-1" />
				<button
					className="mr-2 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-fd-muted-foreground text-xs transition-colors hover:text-fd-foreground"
					onClick={onCopy}
					type="button"
				>
					{checked ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
				</button>
			</div>
			<pre className="px-4 py-3 font-mono text-[13px] text-fd-foreground">
				<span className="text-fd-muted-foreground">$ </span>
				{current.command}
			</pre>
		</div>
	);
}

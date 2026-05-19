"use client";

import dynamic from "next/dynamic";

export const WasmDemo = dynamic(() => import("./wasm-demo").then((mod) => mod.WasmDemo), {
	ssr: false,
	loading: () => (
		<div className="not-prose my-6 flex items-center justify-center rounded-xl border border-fd-border bg-fd-card px-4 py-12 text-fd-muted-foreground text-sm">
			Loading WASM demo…
		</div>
	),
});

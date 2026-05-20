import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";
import { Cable, ChevronRight, Gamepad2, Puzzle, Radio, RefreshCw, Shield, Vibrate } from "lucide-react";
import Link from "next/link";

import { InstallTabs } from "@/components/install-tabs";

const features = [
	{
		icon: Cable,
		title: "Protocol v4",
		description:
			"10 output types and 5 sensor inputs: vibration, rotation, position, oscillation, constriction, and more.",
	},
	{
		icon: Shield,
		title: "Type-safe API",
		description: "TypeScript types with Zod validation on protocol messages.",
	},
	{
		icon: Radio,
		title: "Pattern Engine",
		description: "Keyframe playback, presets, custom tracks, easing, loop control.",
	},
	{
		icon: RefreshCw,
		title: "Auto-reconnect",
		description: "Exponential backoff, attempt limits, lifecycle events.",
	},
	{
		icon: Puzzle,
		title: "Runtime agnostic",
		description: "WebSocket on Node.js, Bun, Deno, and browsers.",
	},
	{
		icon: Gamepad2,
		title: "Device API",
		description: "Discovery, outputs, sensors, capability checks.",
	},
] as const;

const codeExample = `import { ButtplugClient } from "@zendrex/buttplug.js";

const client = new ButtplugClient("ws://localhost:12345");

client.on("device.added", ({ data: { device } }) => {
  device.vibrate(0.5);
});

await client.connect();
await client.startScanning();`;

export default function HomePage() {
	return (
		<div className="flex flex-col">
			<section className="flex flex-col items-center gap-6 px-6 pt-24 pb-16 text-center md:pt-32 md:pb-24">
				<div className="inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-secondary/50 px-4 py-1.5 text-fd-muted-foreground text-sm">
					<Vibrate className="size-3.5" />
					<Link className="hover:text-fd-foreground" href="https://buttplug.io">
						Buttplug <span className="text-fd-foreground">v4</span>
					</Link>
				</div>
				<h1 className="max-w-3xl font-bold text-5xl leading-[1.1] tracking-tight md:text-6xl">
					Intimate hardware control for{" "}
					<span className="bg-linear-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
						modern JavaScript
					</span>
				</h1>
				<p className="max-w-2xl text-fd-muted-foreground text-lg leading-relaxed md:text-xl">
					WebSocket or in-browser WASM. Zod-validated messages, typed devices, optional pattern engine.
				</p>
				<div className="mt-2 flex flex-wrap justify-center gap-3">
					<Link
						className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-6 py-3 font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
						href="/docs/guide"
					>
						Documentation
						<ChevronRight className="size-4" />
					</Link>
					<Link
						className="inline-flex items-center gap-2 rounded-lg border border-fd-border px-6 py-3 font-medium transition-colors hover:bg-fd-accent"
						href="https://github.com/zendrex/buttplug.js"
					>
						GitHub
					</Link>
				</div>
				<div className="mt-6 text-left">
					<InstallTabs />
				</div>
			</section>

			<section className="mx-auto w-full max-w-4xl px-6 pb-16">
				<ServerCodeBlock code={codeExample} lang="ts" />
			</section>

			<section className="border-fd-border border-t bg-fd-card/50 px-6 py-16 md:py-24">
				<div className="mx-auto max-w-5xl">
					<h2 className="mb-12 text-center font-semibold text-3xl tracking-tight">Overview</h2>
					<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{features.map((feature) => (
							<div
								className="rounded-xl border border-fd-border bg-fd-card p-6 transition-colors hover:border-fd-primary/40"
								key={feature.title}
							>
								<feature.icon className="mb-3 size-5 text-fd-primary" />
								<h3 className="mb-2 font-semibold">{feature.title}</h3>
								<p className="text-fd-muted-foreground text-sm leading-relaxed">
									{feature.description}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			<section className="flex flex-col items-center gap-6 px-6 py-16 text-center md:py-24">
				<Link
					className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-6 py-3 font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
					href="/docs/guide/getting-started"
				>
					Getting started
					<ChevronRight className="size-4" />
				</Link>
			</section>
		</div>
	);
}

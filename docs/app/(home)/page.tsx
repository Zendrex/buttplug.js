import { Cable, ChevronRight, Gamepad2, Puzzle, Radio, RefreshCw, Shield, Vibrate } from "lucide-react";
import Link from "next/link";

import { InstallTabs } from "@/components/install-tabs";

const features = [
	{
		icon: Cable,
		title: "Protocol v4",
		description:
			"10 output types and 5 sensor inputs — vibration, rotation, position, oscillation, constriction, and more.",
	},
	{
		icon: Shield,
		title: "Type-safe API",
		description: "Full TypeScript types with Zod schema validation for autocomplete and compile-time safety.",
	},
	{
		icon: Radio,
		title: "Pattern Engine",
		description:
			"Keyframe-based pattern playback with built-in presets, custom tracks, easing curves, and loop control.",
	},
	{
		icon: RefreshCw,
		title: "Auto-reconnect",
		description: "Configurable reconnection with exponential backoff, attempt limits, and lifecycle events.",
	},
	{
		icon: Puzzle,
		title: "Runtime Agnostic",
		description: "Works in any JavaScript runtime with WebSocket support — Node.js, Bun, Deno, and browsers.",
	},
	{
		icon: Gamepad2,
		title: "Device Control",
		description: "High-level API for device discovery, output commands, and sensor reads across all device types.",
	},
] as const;

const codeExample = `import { ButtplugClient } from "@zendrex/buttplug.js";

const client = new ButtplugClient("ws://localhost:12345");

client.on("deviceAdded", ({ device }) => {
  // Good vibrations
  device.vibrate(0.5);
});

await client.connect();
await client.startScanning();`;

export default function HomePage() {
	return (
		<div className="flex flex-col">
			{/* Hero */}
			<section className="flex flex-col items-center gap-6 px-6 pt-24 pb-16 text-center md:pt-32 md:pb-24">
				<div className="inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-secondary/50 px-4 py-1.5 text-fd-muted-foreground text-sm">
					<Vibrate className="size-3.5" />
					Buttplug Protocol v4
				</div>
				<h1 className="max-w-3xl font-bold text-5xl leading-[1.1] tracking-tight md:text-6xl">
					Intimate hardware control for{" "}
					<span className="bg-linear-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
						modern JavaScript
					</span>
				</h1>
				<p className="max-w-2xl text-fd-muted-foreground text-lg leading-relaxed md:text-xl">
					A TypeScript client for the Buttplug Intimacy Protocol. Connect to devices, send commands, read
					sensors, and play patterns — with full type safety and good vibrations.
				</p>
				<div className="mt-2 flex flex-wrap justify-center gap-3">
					<Link
						className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-6 py-3 font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
						href="/docs"
					>
						Get Started
						<ChevronRight className="size-4" />
					</Link>
					<Link
						className="inline-flex items-center gap-2 rounded-lg border border-fd-border px-6 py-3 font-medium transition-colors hover:bg-fd-accent"
						href="/docs/client/api/client"
					>
						API Reference
					</Link>
				</div>
				<div className="mt-6 text-left">
					<InstallTabs />
				</div>
			</section>

			{/* Code Preview */}
			<section className="mx-auto w-full max-w-4xl px-6 pb-16">
				<div className="overflow-hidden rounded-xl border border-fd-border bg-fd-card shadow-lg">
					<div className="flex items-center gap-2 border-fd-border border-b px-4 py-3">
						<div className="size-3 rounded-full bg-fd-muted-foreground/20" />
						<div className="size-3 rounded-full bg-fd-muted-foreground/20" />
						<div className="size-3 rounded-full bg-fd-muted-foreground/20" />
						<span className="ml-2 text-fd-muted-foreground text-xs">quickstart.ts</span>
					</div>
					<pre className="overflow-x-auto p-6 font-mono text-[13px] text-fd-foreground leading-relaxed">
						<code>{codeExample}</code>
					</pre>
				</div>
			</section>

			{/* Features */}
			<section className="border-fd-border border-t bg-fd-card/50 px-6 py-16 md:py-24">
				<div className="mx-auto max-w-5xl">
					<h2 className="mb-4 text-center font-semibold text-3xl tracking-tight">Pleasure, engineered</h2>
					<p className="mx-auto mb-12 max-w-2xl text-center text-fd-muted-foreground text-lg">
						Everything you need to build intimate applications with confidence.
					</p>
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

			{/* CTA */}
			<section className="flex flex-col items-center gap-6 px-6 py-16 text-center md:py-24">
				<h2 className="font-semibold text-3xl tracking-tight">Ready to turn things on?</h2>
				<p className="max-w-lg text-fd-muted-foreground text-lg">
					Follow the getting started guide to connect to your first device in minutes.
				</p>
				<div className="flex flex-wrap justify-center gap-3">
					<Link
						className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-6 py-3 font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
						href="/docs/client/getting-started"
					>
						Read the Guide
						<ChevronRight className="size-4" />
					</Link>
					<Link
						className="inline-flex items-center gap-2 rounded-lg border border-fd-border px-6 py-3 font-medium transition-colors hover:bg-fd-accent"
						href="/docs/patterns"
					>
						Explore Patterns
					</Link>
				</div>
			</section>
		</div>
	);
}

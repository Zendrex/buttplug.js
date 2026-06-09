import { ButtplugClient, consoleLogger } from "@zendrex/buttplug.js";
import { WasmTransport } from "@zendrex/buttplug.js/wasm";

const logEl = document.getElementById("log") as HTMLPreElement;
const log = (message: string) => {
	logEl.textContent += `${message}\n`;
};

const transport = new WasmTransport({
	logger: consoleLogger,
	enableLogging: true,
	logLevel: "debug",
});
const client = new ButtplugClient(transport, { autoPing: true, verbose: true });

client.on("connection.connected", () => log("connected to in-process WASM server"));
client.on("connection.disconnected", ({ data: { reason } }) => log(`disconnected${reason ? `: ${reason}` : ""}`));
client.on("device.added", ({ data: { device } }) => log(`device added: ${device.displayName ?? device.name}`));
client.on("device.removed", ({ data: { device } }) => log(`device removed: ${device.name}`));
client.on("connection.error", ({ data: { error } }) => log(`error: ${error.message}`));
client.on("scan.finished", () => log("scanning finished"));

document.getElementById("connect")?.addEventListener("click", async () => {
	try {
		await client.connect();
	} catch (error) {
		log(`connect failed: ${(error as Error).message}`);
	}
});

document.getElementById("scan")?.addEventListener("click", async () => {
	await client.startScanning();
	log("scanning... browser will prompt for Bluetooth device");
});

document.getElementById("vibe")?.addEventListener("click", async () => {
	for (const device of client.devices) {
		if (device.canOutput("Vibrate")) {
			await device.vibrate(0.5);
			setTimeout(() => device.stop(), 2000);
		}
	}
});

document.getElementById("stop")?.addEventListener("click", async () => {
	await client.stopAll();
});

document.getElementById("disconnect")?.addEventListener("click", async () => {
	await client.disconnect("user clicked disconnect");
});

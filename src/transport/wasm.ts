import { ConnectionError, formatError } from "../lib/errors";
import { noopLogger } from "../lib/logger";
import { TransportEventEmitter } from "./event-emitter";
import type { Logger } from "../lib/logger";
import type { Transport, TransportState } from "./types";

export interface WasmTransportOptions {
	/**
	 * Activate the WASM server's internal `env_logger` on connect.
	 * @defaultValue false
	 */
	enableLogging?: boolean;
	logger?: Logger;
	/**
	 * Log level passed to `activateLogging` when `enableLogging` is true.
	 * @defaultValue "info"
	 */
	logLevel?: string;
}

type WasmModule = typeof import("buttplug-wasm-blob");

const WASM_CLOSE_CODE = 1000;
const WASM_CLOSE_REASON = "Client disconnect";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * In-process Buttplug transport backed by `buttplug-wasm-blob`. Runs an embedded server
 * compiled to WebAssembly with Web Bluetooth bindings — Chromium-family browsers over HTTPS only.
 *
 * @remarks `buttplug-wasm-blob` is an optional peer dependency.
 */
export class WasmTransport extends TransportEventEmitter implements Transport {
	private readonly enableLogging: boolean;
	private readonly logLevel: string;
	private wasm: WasmModule | null = null;
	private handle: number | null = null;
	private _state: TransportState = "disconnected";

	constructor(options: WasmTransportOptions = {}) {
		super((options.logger ?? noopLogger).child("wasm-transport"));
		this.enableLogging = options.enableLogging ?? false;
		this.logLevel = options.logLevel ?? "info";
	}

	async connect(): Promise<void> {
		if (this._state === "connected") {
			return;
		}
		this.assertEnvironment();
		this._state = "connecting";
		try {
			const mod = (await import("buttplug-wasm-blob")) as WasmModule;
			await mod.loadButtplugWasm();
			if (this.enableLogging) {
				mod.activateLogging(this.logLevel);
			}
			this.handle = mod.createServer((msg) => this.handleIncoming(msg));
			this.wasm = mod;
			this._state = "connected";
			this.logger.info("WASM server created");
			this.emit("open");
		} catch (error) {
			this._state = "disconnected";
			this.wasm = null;
			this.handle = null;
			throw new ConnectionError(
				`Failed to start WASM server: ${formatError(error)}`,
				error instanceof Error ? error : undefined
			);
		}
	}

	disconnect(): Promise<void> {
		if (this._state === "disconnected") {
			return Promise.resolve();
		}
		try {
			if (this.wasm && this.handle !== null) {
				this.wasm.freeServer(this.handle);
			}
		} catch (error) {
			this.logger.error(`Error freeing WASM server: ${formatError(error)}`);
		}
		this.handle = null;
		this.wasm = null;
		this._state = "disconnected";
		this.logger.info("WASM server freed");
		this.emit("close", WASM_CLOSE_CODE, WASM_CLOSE_REASON);
		return Promise.resolve();
	}

	get state(): TransportState {
		return this._state;
	}

	send(data: string): void {
		if (!this.wasm || this.handle === null || this._state !== "connected") {
			throw new ConnectionError("Cannot send: WASM server is not running");
		}
		try {
			this.wasm.sendMessage(this.handle, encoder.encode(data), (reply) => this.handleIncoming(reply));
		} catch (error) {
			throw new ConnectionError(
				`Failed to send data: ${formatError(error)}`,
				error instanceof Error ? error : undefined
			);
		}
	}

	private handleIncoming(bytes: Uint8Array): void {
		if (bytes.byteLength === 0) {
			return;
		}
		try {
			this.emit("message", decoder.decode(bytes));
		} catch (error) {
			this.logger.error(`Failed to decode WASM message: ${formatError(error)}`);
			this.emit("error", new ConnectionError(`Failed to decode WASM message: ${formatError(error)}`));
		}
	}

	private assertEnvironment(): void {
		const nav = (globalThis as { navigator?: { bluetooth?: unknown } }).navigator;
		if (!(nav && "bluetooth" in nav)) {
			throw new ConnectionError(
				"WasmTransport requires a browser with Web Bluetooth (Chromium-family) over HTTPS"
			);
		}
	}
}

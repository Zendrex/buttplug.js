import type { Logger } from "../lib/logger";

import { formatError, TimeoutError } from "../lib/errors";
import { noopLogger } from "../lib/logger";

const MIN_PING_INTERVAL_MS = 100;
const DEFAULT_PING_TIMEOUT_MS = 5000;

/**
 * Configuration for {@link PingManager}.
 */
export interface PingOptions {
	/** Whether to automatically send periodic pings. Defaults to `true`. */
	autoPing?: boolean;
	/** Cancels an in-flight ping with the given error (e.g. on timeout). */
	cancelPing: (error: Error) => void;
	/** Returns whether the transport is currently connected. */
	isConnected: () => boolean;
	/** Optional logger for ping diagnostics. Defaults to a no-op logger. */
	logger?: Logger;
	/** Called to initiate a disconnect when a ping times out while still connected. */
	onDisconnect: (reason: string) => Promise<void>;
	/** Called when a ping fails with a non-timeout error. */
	onError: (error: Error) => void;
	/** Sends a protocol-level ping and resolves when the pong arrives. */
	sendPing: () => Promise<void>;
}

/**
 * Schedules periodic keep-alive pings over a {@link Transport} and triggers
 * disconnect when the server stops responding within the allowed time.
 *
 * **Important**: Callers must call {@link PingManager.stop} when the transport
 * disconnects. The PingManager does not subscribe to transport events directly.
 */
export class PingManager {
	/** Sends a protocol-level ping and resolves when the pong arrives. */
	readonly #sendPing: () => Promise<void>;
	/** Cancels an in-flight ping with the given error (e.g. on timeout). */
	readonly #cancelPing: (error: Error) => void;
	/** Logger for ping diagnostics. */
	readonly #logger: Logger;
	/** Whether automatic periodic pings are enabled. */
	readonly #autoPing: boolean;
	/** Callback invoked when a ping fails with a non-timeout error. */
	readonly #onError: (error: Error) => void;
	/** Callback to initiate disconnect when a ping times out. */
	readonly #onDisconnect: (reason: string) => Promise<void>;
	/** Returns whether the transport is currently connected. */
	readonly #isConnected: () => boolean;

	/** Interval timer that triggers periodic ping attempts. */
	#pingTimer: ReturnType<typeof setInterval> | null = null;
	/** Tracks whether a ping request is currently awaiting a response. */
	#pingInFlight = false;
	/** Maximum time in ms the server allows between pings. */
	#maxPingTime = 0;

	constructor(options: PingOptions) {
		this.#sendPing = options.sendPing;
		this.#cancelPing = options.cancelPing;
		this.#logger = (options.logger ?? noopLogger).child("ping");
		this.#autoPing = options.autoPing ?? true;
		this.#onError = options.onError;
		this.#onDisconnect = options.onDisconnect;
		this.#isConnected = options.isConnected;
	}

	/**
	 * Starts the periodic ping timer.
	 *
	 * The ping interval is 60% of `maxPingTime`, clamped to a minimum of 100ms.
	 * Stops any previously running timer before starting a new one.
	 *
	 * **Important**: Callers must call {@link PingManager.stop} when the transport
	 * disconnects to prevent pings from being sent to a closed connection.
	 *
	 * @param maxPingTime - Maximum time in ms the server allows between pings
	 */
	start(maxPingTime: number): void {
		// Cancel any in-flight ping before stopping the timer to avoid orphaned promises
		if (this.#pingInFlight) {
			this.#cancelPing(new TimeoutError("Ping", 0));
		}
		this.stop();
		this.#maxPingTime = maxPingTime;

		if (!this.#autoPing || maxPingTime <= 0) {
			return;
		}

		const pingInterval = Math.max(Math.floor(maxPingTime * 0.6), MIN_PING_INTERVAL_MS);
		this.#logger.debug(`Starting ping timer with interval ${pingInterval}ms`);

		this.#pingTimer = setInterval(() => {
			if (!this.#isConnected()) {
				return;
			}
			if (this.#pingInFlight) {
				this.#logger.warn("Skipping ping: previous ping still in flight");
				return;
			}
			this.#pingInFlight = true;
			this.#doPing().finally(() => {
				this.#pingInFlight = false;
			});
		}, pingInterval);
	}

	/** Stops the ping timer and resets in-flight state. */
	stop(): void {
		if (this.#pingTimer !== null) {
			clearInterval(this.#pingTimer);
			this.#pingTimer = null;
			this.#pingInFlight = false;
			this.#logger.debug("Stopped ping timer");
		}
	}

	/** Sends a single ping and handles timeout or failure. */
	async #doPing(): Promise<void> {
		this.#logger.debug("Sending ping");

		const maxPingTime = this.#maxPingTime || DEFAULT_PING_TIMEOUT_MS;

		const timer = setTimeout(() => {
			this.#cancelPing(new TimeoutError("Ping", maxPingTime));
		}, maxPingTime);

		try {
			await this.#sendPing();
		} catch (err) {
			const isTimeout = err instanceof TimeoutError;
			this.#logger.error(`Ping failed: ${formatError(err)}`);
			this.#onError(err instanceof Error ? err : new Error(String(err)));
			// Only disconnect on timeout errors — transient errors are recoverable
			if (isTimeout && this.#isConnected()) {
				await this.#onDisconnect("Ping response timeout");
			} else if (!isTimeout) {
				this.#logger.warn("Ping failed with non-timeout error, not disconnecting");
			}
		} finally {
			clearTimeout(timer);
		}
	}
}

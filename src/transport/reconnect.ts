import type { Logger } from "../lib/logger";
import type { Transport } from "./types";

import { formatError } from "../lib/errors";
import { noopLogger } from "../lib/logger";
import { ReconnectDefaults } from "./constants";

/** Maximum safe exponent to prevent integer overflow in backoff calculation. */
const MAX_BACKOFF_EXPONENT = 30;

/**
 * Configuration for {@link ReconnectHandler}.
 */
export interface ReconnectOptions {
	/** Optional logger for reconnection diagnostics. Defaults to a no-op logger. */
	logger?: Logger;
	/** Maximum number of reconnect attempts before giving up. Defaults to 10. */
	maxReconnectAttempts?: number;
	/** Upper bound in ms for exponential backoff. Defaults to 30000ms. */
	maxReconnectDelay?: number;
	/** Called when all reconnect attempts are exhausted. */
	onFailed?: (reason: string) => void;
	/** Called when reconnection succeeds. */
	onReconnected?: () => void;
	/** Called before each reconnect attempt with the current attempt number. */
	onReconnecting?: (attempt: number) => void;
	/** Base delay in ms before the first reconnect attempt. Defaults to 1000ms. */
	reconnectDelay?: number;
	/** The {@link Transport} instance to reconnect. */
	transport: Transport;
	/** The WebSocket endpoint URL to reconnect to. */
	url: string;
}

/**
 * Manages automatic reconnection to a {@link Transport} using exponential backoff.
 *
 * Attempts are scheduled with increasing delays up to {@link ReconnectOptions.maxReconnectDelay},
 * and stop after {@link ReconnectOptions.maxReconnectAttempts} failures.
 */
export class ReconnectHandler {
	/** The WebSocket endpoint URL to reconnect to. */
	readonly #url: string;
	/** The transport instance to reconnect. */
	readonly #transport: Transport;
	/** Base delay in ms before the first reconnect attempt. */
	readonly #reconnectDelay: number;
	/** Upper bound in ms for exponential backoff. */
	readonly #maxReconnectDelay: number;
	/** Maximum number of reconnect attempts before giving up. */
	readonly #maxReconnectAttempts: number;
	/** Logger for reconnection diagnostics. */
	readonly #logger: Logger;
	/** Callback invoked before each reconnect attempt. */
	readonly #onReconnecting?: (attempt: number) => void;
	/** Callback invoked when reconnection succeeds. */
	readonly #onReconnected?: () => void;
	/** Callback invoked when all reconnect attempts are exhausted. */
	readonly #onFailed?: (reason: string) => void;

	/** Current reconnect attempt number, incremented before each attempt. */
	#reconnectAttempt = 0;
	/** Timer that schedules the next reconnect attempt. */
	#reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	/** Whether a reconnection sequence is currently active. */
	#reconnecting = false;
	/** Whether the reconnection sequence was explicitly cancelled. */
	#cancelled = false;

	constructor(options: ReconnectOptions) {
		this.#url = options.url;
		this.#transport = options.transport;
		this.#reconnectDelay = options.reconnectDelay ?? ReconnectDefaults.DELAY;
		this.#maxReconnectDelay = options.maxReconnectDelay ?? ReconnectDefaults.MAX_DELAY;
		this.#maxReconnectAttempts = options.maxReconnectAttempts ?? ReconnectDefaults.MAX_ATTEMPTS;
		this.#logger = (options.logger ?? noopLogger).child("reconnect");
		this.#onReconnecting = options.onReconnecting;
		this.#onReconnected = options.onReconnected;
		this.#onFailed = options.onFailed;
	}

	/**
	 * Begins the reconnection sequence.
	 *
	 * No-ops if a reconnection is already in progress.
	 */
	start(): void {
		if (this.#reconnecting) {
			return;
		}
		this.#logger.info("Starting reconnection sequence");
		this.#reconnecting = true;
		this.#cancelled = false;
		this.#attemptReconnect();
	}

	/** Cancels the reconnection sequence and clears any pending timers. */
	cancel(): void {
		this.#logger.debug("Reconnect cancelled");
		this.#cancelled = true;
		if (this.#reconnectTimer) {
			clearTimeout(this.#reconnectTimer);
			this.#reconnectTimer = null;
		}
		this.#reconnecting = false;
		this.#reconnectAttempt = 0;
	}

	/** Whether a reconnection sequence is currently in progress. */
	get active(): boolean {
		return this.#reconnecting;
	}

	/** Safely invokes a user callback, catching and logging any errors. */
	#safeCallback(name: string, fn: () => void | Promise<void>): void {
		try {
			const result = fn();
			if (result instanceof Promise) {
				result.catch((err) => {
					this.#logger.error(`Error in async ${name} callback: ${formatError(err)}`);
				});
			}
		} catch (err) {
			this.#logger.error(`Error in ${name} callback: ${formatError(err)}`);
		}
	}

	/** Schedules the next reconnect attempt with exponential backoff. */
	#attemptReconnect(): void {
		if (this.#cancelled || !this.#reconnecting) {
			return;
		}

		this.#reconnectAttempt++;

		if (this.#reconnectAttempt > this.#maxReconnectAttempts) {
			const reason = `Failed to reconnect after ${this.#maxReconnectAttempts} attempts`;
			this.#logger.error(reason);
			this.#reconnecting = false;
			if (this.#onFailed) {
				this.#safeCallback("onFailed", () => this.#onFailed?.(reason));
			}
			return;
		}

		if (this.#onReconnecting) {
			this.#safeCallback("onReconnecting", () => this.#onReconnecting?.(this.#reconnectAttempt));
		}

		// Cap exponent to prevent integer overflow for large attempt counts
		const exponent = Math.min(this.#reconnectAttempt - 1, MAX_BACKOFF_EXPONENT);
		const delay = Math.min(this.#reconnectDelay * 2 ** exponent, this.#maxReconnectDelay);

		this.#logger.info(
			`Reconnect attempt ${this.#reconnectAttempt}/${this.#maxReconnectAttempts} (delay: ${delay}ms)`
		);

		this.#reconnectTimer = setTimeout(async () => {
			if (this.#cancelled || !this.#reconnecting) {
				return;
			}
			try {
				// Ensure transport is disconnected before reconnecting
				if (this.#transport.state !== "disconnected") {
					await this.#transport.disconnect();
				}

				await this.#transport.connect(this.#url);

				if (this.#cancelled) {
					return;
				}

				this.#reconnecting = false;
				this.#reconnectAttempt = 0;
				this.#logger.info("Reconnection successful");
				if (this.#onReconnected) {
					this.#safeCallback("onReconnected", () => this.#onReconnected?.());
				}
			} catch (err) {
				if (this.#cancelled) {
					return;
				}
				this.#logger.debug(`Reconnect attempt ${this.#reconnectAttempt} failed: ${formatError(err)}`);
				this.#attemptReconnect();
			}
		}, delay);
	}
}

import { formatError, TimeoutError } from "../lib/errors";
import { noopLogger } from "../lib/logger";
import type { Logger } from "../lib/logger";

export interface PingOptions {
	autoPing?: boolean;
	cancelPing: (error: Error) => void;
	isConnected: () => boolean;
	logger?: Logger;
	onDisconnect: (reason: string) => Promise<void>;
	onError: (error: Error) => void;
	sendPing: () => Promise<void>;
}

export class PingManager {
	private static readonly DEFAULT_PING_TIMEOUT_MS = 5000;
	private static readonly MIN_PING_INTERVAL_MS = 100;
	private readonly logger: Logger;
	private readonly autoPing: boolean;
	private readonly cancelPing: (error: Error) => void;
	private readonly isConnected: () => boolean;
	private readonly onDisconnect: (reason: string) => Promise<void>;
	private readonly onError: (error: Error) => void;
	private readonly sendPing: () => Promise<void>;
	private pingTimer: ReturnType<typeof setInterval> | null = null;
	private pingInFlight = false;
	private stopped = true;
	private maxPingTime = 0;

	constructor(options: PingOptions) {
		this.logger = (options.logger ?? noopLogger).child("ping");
		this.autoPing = options.autoPing ?? true;
		this.cancelPing = options.cancelPing;
		this.isConnected = options.isConnected;
		this.onDisconnect = options.onDisconnect;
		this.onError = options.onError;
		this.sendPing = options.sendPing;
	}

	start(maxPingTime: number): void {
		if (this.pingInFlight) {
			this.cancelPing(new TimeoutError("Ping", 0));
		}
		this.stop();
		this.stopped = false;
		this.maxPingTime = maxPingTime;

		if (!this.autoPing || maxPingTime <= 0) {
			return;
		}

		const pingInterval = Math.max(Math.floor(maxPingTime * 0.6), PingManager.MIN_PING_INTERVAL_MS);
		this.logger.debug(`Starting ping timer with interval ${pingInterval}ms`);

		this.pingTimer = setInterval(() => {
			if (!this.isConnected()) {
				return;
			}
			if (this.pingInFlight) {
				this.logger.warn("Skipping ping: previous ping still in flight");
				return;
			}
			this.pingInFlight = true;
			this.doPing().finally(() => {
				this.pingInFlight = false;
			});
		}, pingInterval);
	}

	stop(): void {
		this.stopped = true;

		if (this.pingTimer !== null) {
			clearInterval(this.pingTimer);
			this.pingTimer = null;
			this.pingInFlight = false;
			this.logger.debug("Stopped ping timer");
		}
	}

	private async doPing(): Promise<void> {
		if (this.stopped) {
			return;
		}

		this.logger.debug("Sending ping");

		const maxPingTime = this.maxPingTime || PingManager.DEFAULT_PING_TIMEOUT_MS;

		const timer = setTimeout(() => {
			if (this.stopped) {
				return;
			}
			this.cancelPing(new TimeoutError("Ping", maxPingTime));
		}, maxPingTime);

		try {
			await this.sendPing();
		} catch (err) {
			if (this.stopped) {
				return;
			}

			const isTimeout = err instanceof TimeoutError;
			this.logger.error(`Ping failed: ${formatError(err)}`);
			this.onError(err instanceof Error ? err : new Error(String(err)));
			if (isTimeout && this.isConnected()) {
				await this.onDisconnect("Ping response timeout");
			} else if (!isTimeout) {
				this.logger.warn("Ping failed with non-timeout error, not disconnecting");
			}
		} finally {
			clearTimeout(timer);
		}
	}
}

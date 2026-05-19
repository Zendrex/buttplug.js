import { formatError } from "../lib/errors";
import { noopLogger } from "../lib/logger";
import { ReconnectDefaults } from "./constants";
import type { Logger } from "../lib/logger";
import type { Transport } from "./types";

export interface ReconnectOptions {
	logger?: Logger;
	maxReconnectAttempts?: number;
	maxReconnectDelay?: number;
	onFailed?: (reason: string) => void;
	onReconnected?: () => void;
	onReconnecting?: (attempt: number) => void;
	reconnectDelay?: number;
	transport: Transport;
}

const MAX_BACKOFF_EXPONENT = 30;

export class ReconnectHandler {
	private readonly logger: Logger;
	private readonly maxReconnectAttempts: number;
	private readonly maxReconnectDelay: number;
	private readonly onFailed?: (reason: string) => void;
	private readonly onReconnected?: () => void;
	private readonly onReconnecting?: (attempt: number) => void;
	private readonly reconnectDelay: number;
	private readonly transport: Transport;
	private reconnectAttempt = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnecting = false;
	private cancelled = false;

	constructor(options: ReconnectOptions) {
		this.logger = (options.logger ?? noopLogger).child("reconnect");
		this.maxReconnectAttempts = options.maxReconnectAttempts ?? ReconnectDefaults.MAX_ATTEMPTS;
		this.maxReconnectDelay = options.maxReconnectDelay ?? ReconnectDefaults.MAX_DELAY;
		this.onFailed = options.onFailed;
		this.onReconnected = options.onReconnected;
		this.onReconnecting = options.onReconnecting;
		this.reconnectDelay = options.reconnectDelay ?? ReconnectDefaults.DELAY;
		this.transport = options.transport;
	}

	start(): void {
		if (this.reconnecting) {
			return;
		}
		this.logger.info("Starting reconnection sequence");
		this.reconnecting = true;
		this.cancelled = false;
		this.attemptReconnect();
	}

	cancel(): void {
		this.logger.debug("Reconnect cancelled");
		this.cancelled = true;
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		this.reconnecting = false;
		this.reconnectAttempt = 0;
	}

	get active(): boolean {
		return this.reconnecting;
	}

	private safeCallback(name: string, fn: () => void | Promise<void>): void {
		try {
			const result = fn();
			if (result instanceof Promise) {
				result.catch((err) => {
					this.logger.error(`Error in async ${name} callback: ${formatError(err)}`);
				});
			}
		} catch (err) {
			this.logger.error(`Error in ${name} callback: ${formatError(err)}`);
		}
	}

	private attemptReconnect(): void {
		if (this.cancelled || !this.reconnecting) {
			return;
		}

		this.reconnectAttempt++;

		if (this.reconnectAttempt > this.maxReconnectAttempts) {
			const reason = `Failed to reconnect after ${this.maxReconnectAttempts} attempts`;
			this.logger.error(reason);
			this.reconnecting = false;
			if (this.onFailed) {
				this.safeCallback("onFailed", () => this.onFailed?.(reason));
			}
			return;
		}

		if (this.onReconnecting) {
			this.safeCallback("onReconnecting", () => this.onReconnecting?.(this.reconnectAttempt));
		}

		const exponent = Math.min(this.reconnectAttempt - 1, MAX_BACKOFF_EXPONENT);
		const delay = Math.min(this.reconnectDelay * 2 ** exponent, this.maxReconnectDelay);

		this.logger.info(`Reconnect attempt ${this.reconnectAttempt}/${this.maxReconnectAttempts} (delay: ${delay}ms)`);

		this.reconnectTimer = setTimeout(async () => {
			if (this.cancelled || !this.reconnecting) {
				return;
			}
			try {
				if (this.transport.state !== "disconnected") {
					await this.transport.disconnect();
				}

				await this.transport.connect();

				if (this.cancelled) {
					return;
				}

				this.reconnecting = false;
				this.reconnectAttempt = 0;
				this.logger.info("Reconnection successful");
				if (this.onReconnected) {
					this.safeCallback("onReconnected", () => this.onReconnected?.());
				}
			} catch (err) {
				if (this.cancelled) {
					return;
				}
				this.logger.debug(`Reconnect attempt ${this.reconnectAttempt} failed: ${formatError(err)}`);
				this.attemptReconnect();
			}
		}, delay);
	}
}

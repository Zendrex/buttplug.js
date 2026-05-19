import { ConnectionError, formatError } from "../lib/errors";
import { noopLogger } from "../lib/logger";
import type { Logger } from "../lib/logger";
import type { Transport, TransportEventName, TransportEvents, TransportState } from "./types";

export interface WebSocketTransportOptions {
	logger?: Logger;
}

const CLIENT_DISCONNECT_CODE = 1000;
const CLIENT_DISCONNECT_REASON = "Client disconnect";

export class WebSocketTransport implements Transport {
	private readonly listeners = new Map<TransportEventName, Set<TransportEvents[TransportEventName]>>();
	private readonly logger: Logger;
	private readonly url: string;
	private connectPromise: Promise<void> | null = null;
	private disconnectRequested = false;
	private handleMessage: ((event: MessageEvent) => void) | null = null;
	private handleClose: ((event: CloseEvent) => void) | null = null;
	private handleError: ((event: Event) => void) | null = null;
	private _state: TransportState = "disconnected";
	private ws: WebSocket | null = null;

	constructor(url: string, options: WebSocketTransportOptions = {}) {
		this.url = url;
		this.logger = (options.logger ?? noopLogger).child("ws-transport");
	}

	connect(): Promise<void> {
		const url = this.url;
		if (this._state === "connected") {
			return Promise.resolve();
		}

		if (this.connectPromise) {
			return this.connectPromise;
		}

		this._state = "connecting";
		this.disconnectRequested = false;
		this.logger.debug(`Opening WebSocket connection to ${url}`);

		this.connectPromise = new Promise<void>((resolve, reject) => {
			try {
				this.ws = new WebSocket(url);
			} catch (error) {
				this._state = "disconnected";
				reject(
					new ConnectionError(
						`Failed to create WebSocket: ${formatError(error)}`,
						error instanceof Error ? error : undefined
					)
				);
				return;
			}

			const handleOpen = () => {
				cleanup();

				if (this.disconnectRequested) {
					this.disconnectRequested = false;
					this.cleanup();
					resolve();
					return;
				}

				this._state = "connected";
				this.attachHandlers();
				this.logger.info("WebSocket connected");
				this.emit("open");
				resolve();
			};

			const handleConnectError = (event: Event) => {
				cleanup();
				this.logger.error(`WebSocket error during connect: ${event.type}`);
				const error = new ConnectionError(`WebSocket error: ${event.type}`);
				this._state = "disconnected";
				this.ws = null;
				this.emit("error", error);
				reject(error);
			};

			const handleConnectClose = (event: CloseEvent) => {
				cleanup();
				this._state = "disconnected";
				this.ws = null;
				const reason = event.reason || `Code: ${event.code}`;
				this.logger.info(`WebSocket closed during connect (code: ${event.code})`);
				this.emit("close", event.code, reason);
				reject(new ConnectionError(`WebSocket closed during connect: ${reason}`));
			};

			const cleanup = () => {
				if (this.ws) {
					this.ws.removeEventListener("open", handleOpen);
					this.ws.removeEventListener("error", handleConnectError);
					this.ws.removeEventListener("close", handleConnectClose);
				}
			};

			this.ws.addEventListener("open", handleOpen);
			this.ws.addEventListener("error", handleConnectError);
			this.ws.addEventListener("close", handleConnectClose);
		}).finally(() => {
			this.connectPromise = null;
		});

		return this.connectPromise;
	}

	disconnect(): Promise<void> {
		if (this._state === "disconnected") {
			return Promise.resolve();
		}

		if (this.connectPromise) {
			this.disconnectRequested = true;
		}

		this.logger.info("Disconnecting WebSocket");

		if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
			this.cleanup();
			return Promise.resolve();
		}

		return new Promise<void>((resolve) => {
			const ws = this.ws;
			if (!ws) {
				this.cleanup();
				resolve();
				return;
			}

			const onClose = () => {
				ws.removeEventListener("close", onClose);
				this.cleanup();
				resolve();
			};
			ws.addEventListener("close", onClose);

			if (ws.readyState !== WebSocket.CLOSING) {
				ws.close(CLIENT_DISCONNECT_CODE, CLIENT_DISCONNECT_REASON);
			}
		});
	}

	get state(): TransportState {
		return this._state;
	}

	send(data: string): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			throw new ConnectionError("Cannot send: WebSocket is not connected");
		}
		try {
			this.ws.send(data);
		} catch (error) {
			throw new ConnectionError(
				`Failed to send data: ${formatError(error)}`,
				error instanceof Error ? error : undefined
			);
		}
	}

	on<E extends TransportEventName>(event: E, handler: TransportEvents[E]): void {
		let handlers = this.listeners.get(event);
		if (!handlers) {
			handlers = new Set();
			this.listeners.set(event, handlers);
		}
		handlers.add(handler);
	}

	off<E extends TransportEventName>(event: E, handler: TransportEvents[E]): void {
		const handlers = this.listeners.get(event);
		if (handlers) {
			handlers.delete(handler);
		}
	}

	private emit<E extends TransportEventName>(event: E, ...args: Parameters<TransportEvents[E]>): void {
		const handlers = this.listeners.get(event);
		if (!handlers) {
			return;
		}
		for (const handler of handlers) {
			try {
				(handler as (...a: unknown[]) => void)(...args);
			} catch (err) {
				this.logger.error(`Error in ${event} handler: ${formatError(err)}`);
			}
		}
	}

	private attachHandlers(): void {
		const ws = this.ws;
		if (!ws) {
			return;
		}

		this.handleMessage = (event: MessageEvent) => {
			if (typeof event.data === "string") {
				this.emit("message", event.data);
			}
		};

		this.handleClose = (event: CloseEvent) => {
			this.removeHandlers();
			this._state = "disconnected";
			this.ws = null;
			const reason = event.reason || `Code: ${event.code}`;
			this.logger.info(`WebSocket closed (code: ${event.code}, reason: ${reason})`);
			this.emit("close", event.code, reason);
		};

		this.handleError = (event: Event) => {
			this.logger.error(`WebSocket error: ${event.type}`);
			this.emit("error", new ConnectionError(`WebSocket error: ${event.type}`));
		};

		ws.addEventListener("message", this.handleMessage);
		ws.addEventListener("close", this.handleClose);
		ws.addEventListener("error", this.handleError);
	}

	private removeHandlers(): void {
		const ws = this.ws;
		if (!ws) {
			return;
		}
		if (this.handleMessage) {
			ws.removeEventListener("message", this.handleMessage);
			this.handleMessage = null;
		}
		if (this.handleClose) {
			ws.removeEventListener("close", this.handleClose);
			this.handleClose = null;
		}
		if (this.handleError) {
			ws.removeEventListener("error", this.handleError);
			this.handleError = null;
		}
	}

	private cleanup(): void {
		this.removeHandlers();
		this.ws = null;
		this._state = "disconnected";
		this.logger.debug("WebSocket cleaned up");
	}
}

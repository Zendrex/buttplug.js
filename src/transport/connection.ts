import { ConnectionError, formatError } from "../lib/errors";
import { noopLogger } from "../lib/logger";
import { TransportEventEmitter } from "./event-emitter";
import type { Logger } from "../lib/logger";
import type { Transport, TransportState } from "./types";

export interface WebSocketTransportOptions {
	logger?: Logger;
}

const CLIENT_DISCONNECT_CODE = 1000;
const CLIENT_DISCONNECT_REASON = "Client disconnect";

export class WebSocketTransport extends TransportEventEmitter implements Transport {
	private readonly url: string;
	private connectPromise: Promise<void> | null = null;
	private disconnectRequested = false;
	private onWsMessage: ((event: MessageEvent) => void) | null = null;
	private onWsClose: ((event: CloseEvent) => void) | null = null;
	private onWsError: ((event: Event) => void) | null = null;
	private _state: TransportState = "disconnected";
	private ws: WebSocket | null = null;

	constructor(url: string, options: WebSocketTransportOptions = {}) {
		super((options.logger ?? noopLogger).child("ws-transport"));
		this.url = url;
	}

	get state(): TransportState {
		return this._state;
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

			const onOpen = () => {
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

			const onConnectError = (event: Event) => {
				cleanup();
				this.logger.error(`WebSocket error during connect: ${event.type}`);
				const error = new ConnectionError(`WebSocket error: ${event.type}`);
				this._state = "disconnected";
				this.ws = null;
				this.emit("error", error);
				reject(error);
			};

			const onConnectClose = (event: CloseEvent) => {
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
					this.ws.removeEventListener("open", onOpen);
					this.ws.removeEventListener("error", onConnectError);
					this.ws.removeEventListener("close", onConnectClose);
				}
			};

			this.ws.addEventListener("open", onOpen);
			this.ws.addEventListener("error", onConnectError);
			this.ws.addEventListener("close", onConnectClose);
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

	private attachHandlers(): void {
		const ws = this.ws;
		if (!ws) {
			return;
		}

		this.onWsMessage = (event: MessageEvent) => {
			if (typeof event.data === "string") {
				this.emit("message", event.data);
			}
		};

		this.onWsClose = (event: CloseEvent) => {
			this.removeHandlers();
			this._state = "disconnected";
			this.ws = null;
			const reason = event.reason || `Code: ${event.code}`;
			this.logger.info(`WebSocket closed (code: ${event.code}, reason: ${reason})`);
			this.emit("close", event.code, reason);
		};

		this.onWsError = (event: Event) => {
			this.logger.error(`WebSocket error: ${event.type}`);
			this.emit("error", new ConnectionError(`WebSocket error: ${event.type}`));
		};

		ws.addEventListener("message", this.onWsMessage);
		ws.addEventListener("close", this.onWsClose);
		ws.addEventListener("error", this.onWsError);
	}

	private removeHandlers(): void {
		const ws = this.ws;
		if (!ws) {
			return;
		}
		if (this.onWsMessage) {
			ws.removeEventListener("message", this.onWsMessage);
			this.onWsMessage = null;
		}
		if (this.onWsClose) {
			ws.removeEventListener("close", this.onWsClose);
			this.onWsClose = null;
		}
		if (this.onWsError) {
			ws.removeEventListener("error", this.onWsError);
			this.onWsError = null;
		}
	}

	private cleanup(): void {
		this.removeHandlers();
		this.ws = null;
		this._state = "disconnected";
		this.logger.debug("WebSocket cleaned up");
	}
}

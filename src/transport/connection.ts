import type { Logger } from "../lib/logger";
import type { Transport, TransportEventName, TransportEvents, TransportState } from "./types";

import { ConnectionError, formatError } from "../lib/errors";
import { noopLogger } from "../lib/logger";

/**
 * Configuration for {@link WebSocketTransport}.
 */
export interface WebSocketTransportOptions {
	/** Optional logger for connection diagnostics. Defaults to a no-op logger. */
	logger?: Logger;
}

/**
 * {@link Transport} implementation backed by a native WebSocket.
 *
 * Manages the full connection lifecycle including opening, closing,
 * message dispatch, and event propagation.
 */
export class WebSocketTransport implements Transport {
	/** Logger for connection diagnostics. */
	readonly #logger: Logger;
	/** Map of event names to sets of handler callbacks. */
	readonly #listeners = new Map<TransportEventName, Set<TransportEvents[TransportEventName]>>();

	/** Active WebSocket instance, null when disconnected. */
	#ws: WebSocket | null = null;
	/** Current connection lifecycle state. */
	#state: TransportState = "disconnected";
	/** Tracks in-flight connection attempt to deduplicate concurrent connect calls. */
	#connectPromise: Promise<void> | null = null;
	/** Set by disconnect() when a connect() is in flight to signal early teardown. */
	#disconnectRequested = false;

	/** Stored handler references for cleanup. */
	#handleMessage: ((event: MessageEvent) => void) | null = null;
	#handleClose: ((event: CloseEvent) => void) | null = null;
	#handleError: ((event: Event) => void) | null = null;

	constructor(options: WebSocketTransportOptions = {}) {
		this.#logger = (options.logger ?? noopLogger).child("ws-transport");
	}

	/**
	 * Opens a WebSocket connection to the given URL.
	 *
	 * Returns immediately if already connected. Deduplicates concurrent
	 * connect calls by returning the same in-flight promise.
	 *
	 * @param url - The WebSocket endpoint to connect to
	 * @throws {ConnectionError} if the connection fails or is closed during handshake
	 */
	connect(url: string): Promise<void> {
		if (this.#state === "connected") {
			return Promise.resolve();
		}

		if (this.#connectPromise) {
			return this.#connectPromise;
		}

		this.#state = "connecting";
		this.#disconnectRequested = false;
		this.#logger.debug(`Opening WebSocket connection to ${url}`);

		this.#connectPromise = new Promise<void>((resolve, reject) => {
			try {
				this.#ws = new WebSocket(url);
			} catch (error) {
				this.#state = "disconnected";
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

				// disconnect() was called while connecting — tear down immediately
				if (this.#disconnectRequested) {
					this.#disconnectRequested = false;
					this.#cleanup();
					resolve();
					return;
				}

				this.#state = "connected";
				this.#attachHandlers();
				this.#logger.info("WebSocket connected");
				this.#emit("open");
				resolve();
			};

			const handleError = (event: Event) => {
				cleanup();
				this.#logger.error(`WebSocket error during connect: ${event.type}`);
				const error = new ConnectionError(`WebSocket error: ${event.type}`);
				this.#state = "disconnected";
				this.#ws = null;
				this.#emit("error", error);
				reject(error);
			};

			const handleClose = (event: CloseEvent) => {
				cleanup();
				this.#state = "disconnected";
				this.#ws = null;
				const reason = event.reason || `Code: ${event.code}`;
				this.#logger.info(`WebSocket closed during connect (code: ${event.code})`);
				this.#emit("close", event.code, reason);
				reject(new ConnectionError(`WebSocket closed during connect: ${reason}`));
			};

			const cleanup = () => {
				if (this.#ws) {
					this.#ws.removeEventListener("open", handleOpen);
					this.#ws.removeEventListener("error", handleError);
					this.#ws.removeEventListener("close", handleClose);
				}
			};

			this.#ws.addEventListener("open", handleOpen);
			this.#ws.addEventListener("error", handleError);
			this.#ws.addEventListener("close", handleClose);
		}).finally(() => {
			this.#connectPromise = null;
		});

		return this.#connectPromise;
	}

	/**
	 * Closes the active WebSocket connection.
	 *
	 * No-ops if already disconnected. Waits for the close handshake to complete
	 * if the socket is currently open or closing.
	 */
	disconnect(): Promise<void> {
		if (this.#state === "disconnected") {
			return Promise.resolve();
		}

		// Signal in-flight connect() to abort on open
		if (this.#connectPromise) {
			this.#disconnectRequested = true;
		}

		this.#logger.info("Disconnecting WebSocket");

		if (!this.#ws || this.#ws.readyState === WebSocket.CLOSED) {
			this.#cleanup();
			return Promise.resolve();
		}

		return new Promise<void>((resolve) => {
			const ws = this.#ws;

			if (ws?.readyState === WebSocket.CLOSING) {
				const onClose = () => {
					ws.removeEventListener("close", onClose);
					this.#cleanup();
					resolve();
				};
				ws.addEventListener("close", onClose);
				return;
			}

			if (!ws) {
				this.#cleanup();
				resolve();
				return;
			}

			const onClose = () => {
				ws.removeEventListener("close", onClose);
				this.#cleanup();
				resolve();
			};
			ws.addEventListener("close", onClose);
			ws.close(1000, "Client disconnect");
		});
	}

	/**
	 * Sends a text message over the active WebSocket.
	 *
	 * @param data - The string payload to send
	 * @throws {ConnectionError} if the WebSocket is not in the OPEN state or send fails
	 */
	send(data: string): void {
		if (!this.#ws || this.#ws.readyState !== WebSocket.OPEN) {
			throw new ConnectionError("Cannot send: WebSocket is not connected");
		}
		try {
			this.#ws.send(data);
		} catch (error) {
			throw new ConnectionError(
				`Failed to send data: ${formatError(error)}`,
				error instanceof Error ? error : undefined
			);
		}
	}

	/**
	 * Subscribes a handler for the given transport event.
	 *
	 * @param event - The event to listen for
	 * @param handler - The callback to invoke when the event fires
	 */
	on<E extends TransportEventName>(event: E, handler: TransportEvents[E]): void {
		let handlers = this.#listeners.get(event);
		if (!handlers) {
			handlers = new Set();
			this.#listeners.set(event, handlers);
		}
		handlers.add(handler);
	}

	/**
	 * Removes a previously registered handler for the given event.
	 *
	 * @param event - The event to stop listening for
	 * @param handler - The callback to remove
	 */
	off<E extends TransportEventName>(event: E, handler: TransportEvents[E]): void {
		const handlers = this.#listeners.get(event);
		if (handlers) {
			handlers.delete(handler);
		}
	}

	/** Current connection lifecycle state. */
	get state(): TransportState {
		return this.#state;
	}

	/** Dispatches an event to all registered handlers for that event name. */
	#emit<E extends TransportEventName>(event: E, ...args: Parameters<TransportEvents[E]>): void {
		const handlers = this.#listeners.get(event);
		if (!handlers) {
			return;
		}
		for (const handler of handlers) {
			try {
				// Type assertion safe: handler is from a Set keyed by event name, args match the event signature
				(handler as (...a: unknown[]) => void)(...args);
			} catch (err) {
				this.#logger.error(`Error in ${event} handler: ${formatError(err)}`);
			}
		}
	}

	/** Wires up message, close, and error listeners on the active WebSocket. */
	#attachHandlers(): void {
		const ws = this.#ws;
		if (!ws) {
			return;
		}

		this.#handleMessage = (event: MessageEvent) => {
			if (typeof event.data === "string") {
				this.#emit("message", event.data);
			}
		};

		this.#handleClose = (event: CloseEvent) => {
			this.#removeHandlers();
			this.#state = "disconnected";
			this.#ws = null;
			const reason = event.reason || `Code: ${event.code}`;
			this.#logger.info(`WebSocket closed (code: ${event.code}, reason: ${reason})`);
			this.#emit("close", event.code, reason);
		};

		this.#handleError = (event: Event) => {
			this.#logger.error(`WebSocket error: ${event.type}`);
			this.#emit("error", new ConnectionError(`WebSocket error: ${event.type}`));
		};

		ws.addEventListener("message", this.#handleMessage);
		ws.addEventListener("close", this.#handleClose);
		ws.addEventListener("error", this.#handleError);
	}

	/** Removes message/close/error listeners from the active WebSocket. */
	#removeHandlers(): void {
		const ws = this.#ws;
		if (!ws) {
			return;
		}
		if (this.#handleMessage) {
			ws.removeEventListener("message", this.#handleMessage);
			this.#handleMessage = null;
		}
		if (this.#handleClose) {
			ws.removeEventListener("close", this.#handleClose);
			this.#handleClose = null;
		}
		if (this.#handleError) {
			ws.removeEventListener("error", this.#handleError);
			this.#handleError = null;
		}
	}

	/** Removes listeners, nulls the socket reference, and resets state to disconnected. */
	#cleanup(): void {
		this.#removeHandlers();
		this.#ws = null;
		this.#state = "disconnected";
		this.#logger.debug("WebSocket cleaned up");
	}
}

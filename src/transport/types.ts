import type { Logger } from "../lib/logger";

/**
 * Event handler signatures emitted by a {@link Transport}.
 */
export interface TransportEvents {
	/** Provides the WebSocket close code and reason for diagnostics. */
	close: (code: number, reason: string) => void;
	error: (error: Error) => void;
	message: (data: string) => void;
	open: () => void;
}

/**
 * Lifecycle state of a {@link Transport} connection.
 */
export type TransportState = "disconnected" | "connecting" | "connected";

/**
 * Union of event names that a {@link Transport} can emit.
 */
export type TransportEventName = keyof TransportEvents;

/**
 * Base options shared across {@link Transport} implementations.
 */
export interface TransportOptions {
	logger?: Logger;
}

/**
 * Minimal contract for a bidirectional message transport.
 *
 * Implementations handle the underlying connection lifecycle (connect, disconnect, send)
 * and expose an event-based API for incoming data and state changes.
 */
export interface Transport {
	/**
	 * Opens a connection to the given URL.
	 *
	 * @param url - The WebSocket endpoint to connect to
	 */
	connect(url: string): Promise<void>;

	/**
	 * Closes the active connection.
	 *
	 * Implementations should handle cleanup and emit a "close" event.
	 */
	disconnect(): Promise<void>;

	/**
	 * Removes a previously registered handler for the given event.
	 *
	 * @param event - The event to stop listening for
	 * @param handler - The callback to remove
	 */
	off<E extends TransportEventName>(event: E, handler: TransportEvents[E]): void;

	/**
	 * Subscribes a handler for the given event.
	 *
	 * @param event - The event to listen for
	 * @param handler - The callback to invoke when the event fires
	 */
	on<E extends TransportEventName>(event: E, handler: TransportEvents[E]): void;

	/**
	 * Sends a text message over the active connection.
	 *
	 * @param data - The string payload to send
	 * @throws {ConnectionError} if the transport is not connected
	 */
	send(data: string): void;

	readonly state: TransportState;
}

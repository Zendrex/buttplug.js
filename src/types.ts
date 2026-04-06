import type { Device } from "./device";
import type { Logger } from "./lib/logger";
import type { InputReading } from "./protocol/schema";

/**
 * Event map for the {@link ButtplugClient} emitter.
 *
 * Each key is an event name and its value is the payload type passed to listeners.
 */
export interface ClientEventMap {
	/** Emitted after a successful connection and handshake. */
	connected: undefined;
	/** Emitted when a new device is discovered. */
	deviceAdded: { device: Device };
	/** Emitted with the full device list after a reconciliation pass. */
	deviceList: { devices: Device[] };
	/** Emitted when a previously known device is removed. */
	deviceRemoved: { device: Device };
	/** Emitted when a device's metadata is updated by the server. */
	deviceUpdated: { device: Device; previousDevice: Device };
	/** Emitted when the WebSocket connection closes. */
	disconnected: { reason?: string };
	/** Emitted when a transport or protocol error occurs. */
	error: { error: Error };
	/** Emitted when the server pushes an input sensor reading. */
	inputReading: { reading: InputReading };
	/** Emitted after a successful reconnection and re-handshake. */
	reconnected: undefined;
	/** Emitted on each reconnection attempt with the current attempt number. */
	reconnecting: { attempt: number };
	/** Emitted when the server finishes a device scan. */
	scanningFinished: undefined;
}

/**
 * Configuration options for {@link ButtplugClient}.
 */
export interface ButtplugClientOptions {
	/** Whether to automatically send pings to keep the connection alive. Defaults to `true`. */
	autoPing?: boolean;
	/** Whether to automatically reconnect on connection loss. */
	autoReconnect?: boolean;
	/** Display name sent to the server during handshake. */
	clientName?: string;
	/** Logger instance for client diagnostics. */
	logger?: Logger;
	/** Maximum number of reconnection attempts before giving up. */
	maxReconnectAttempts?: number;
	/** Maximum delay in milliseconds between reconnection attempts (exponential backoff cap). */
	maxReconnectDelay?: number;
	/** Initial delay in milliseconds before the first reconnection attempt. */
	reconnectDelay?: number;
	/** Timeout in milliseconds for individual protocol requests. */
	requestTimeout?: number;
}

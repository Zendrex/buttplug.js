import type { Logger } from "../lib/logger";
import type { DeviceFeatures, ErrorMsg, InputReading, RawDevice, ServerMessage } from "../protocol/schema";

/**
 * Tracks an in-flight request awaiting a server response.
 *
 * @typeParam T - The expected response message type
 */
export interface PendingRequest<T = ServerMessage> {
	/** Rejects the pending request with an error. */
	reject: (error: Error) => void;
	/** Resolves the pending request with the server's response. */
	resolve: (value: T) => void;
	/** Cleared to null when the request completes or times out. */
	timeout: ReturnType<typeof setTimeout> | null;
}

/**
 * Configuration for creating a {@link MessageRouter} instance.
 */
export interface MessageRouterOptions {
	/** Logger instance for protocol message tracing. */
	logger?: Logger;
	/** Callback invoked when a device list message is received. */
	onDeviceList?: (devices: RawDevice[]) => void;
	/** Callback invoked when the server sends an error message with ID 0. */
	onError?: (error: ErrorMsg) => void;
	/** Callback invoked when a sensor reading arrives. */
	onInputReading?: (reading: InputReading) => void;
	/** Callback invoked when scanning finishes. */
	onScanningFinished?: () => void;
	/** Transport function that sends serialized JSON to the server. */
	send: (data: string) => void;
	/** Request timeout in milliseconds. Defaults to {@link DEFAULT_REQUEST_TIMEOUT}. */
	timeout?: number;
}

/**
 * Minimum shape required for a device to participate in {@link reconcileDevices} diffing.
 */
export interface ReconcilableDevice {
	/** Normalized input and output capabilities of the device. */
	readonly features: DeviceFeatures;
	/** Server-assigned device index used as a unique identifier. */
	readonly index: number;
	/** Human-readable device name. */
	readonly name: string;
}

/**
 * Callbacks invoked during device list reconciliation.
 *
 * @typeParam T - The concrete device type being reconciled
 */
export interface ReconcileCallbacks<T extends ReconcilableDevice> {
	/** Invoked when a new device appears in the incoming list. */
	onAdded: (device: T) => void;
	/** Invoked after all adds, removes, and updates are processed. */
	onList: (devices: T[]) => void;
	/** Invoked when a previously tracked device is no longer present. */
	onRemoved: (device: T) => void;
	/** Invoked when features differ structurally, not on cosmetic changes. */
	onUpdated: (newDevice: T, oldDevice: T) => void;
}

/**
 * Options for {@link reconcileDevices} to diff current vs incoming device lists.
 *
 * @typeParam T - The concrete device type being reconciled
 */
export interface ReconcileOptions<T extends ReconcilableDevice> {
	/** Callbacks invoked for each reconciliation event. */
	callbacks: ReconcileCallbacks<T>;
	/** Factory function to create a concrete device from a raw descriptor. */
	createDevice: (raw: RawDevice) => T;
	/** Mutated in place to reflect the reconciled state. */
	currentDevices: Map<number, T>;
	/** Raw device descriptors from the latest server message. */
	incomingRaw: RawDevice[];
	/** Logger for reconciliation diagnostics. Defaults to no-op. */
	logger?: Logger;
}

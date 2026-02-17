import type { ClientMessage, InputType, ServerMessage } from "./schema";

/** Callback invoked when a sensor subscription delivers a new reading. */
export type SensorCallback = (value: number) => void;

/**
 * Builds a unique lookup key for a sensor subscription.
 *
 * Combines device index, feature index, and sensor type into a
 * deterministic string for use as a Map/Set key.
 *
 * @param deviceIndex - The device's index in the {@link DeviceList}
 * @param featureIndex - The feature index within the device
 * @param type - The sensor {@link InputType} being subscribed to
 * @returns A hyphen-delimited key string (e.g. "0-1-Battery")
 */
export function sensorKey(deviceIndex: number, featureIndex: number, type: InputType): string {
	return `${deviceIndex}-${featureIndex}-${type}`;
}

/**
 * Interface for sending protocol messages and managing sensor subscriptions.
 *
 * Implemented by the client to provide the transport layer that
 * {@link Device} instances use for communication with the server.
 */
export interface DeviceMessageSender {
	/**
	 * Allocates the next unique message ID for request/response correlation.
	 *
	 * @returns A monotonically increasing integer within the valid ID range
	 */
	nextId(): number;

	/**
	 * Registers a callback to receive sensor readings for a specific subscription.
	 *
	 * @param key - Unique subscription key from {@link sensorKey}
	 * @param callback - Function invoked with each sensor value
	 * @param info - Metadata identifying the device, feature, and sensor type
	 */
	registerSensorSubscription(
		key: string,
		callback: SensorCallback,
		info: { deviceIndex: number; featureIndex: number; type: InputType }
	): void;
	/**
	 * Sends one or more client messages and waits for the server's responses.
	 *
	 * @param messages - A single message or array of messages to send
	 * @returns The server's response messages
	 */
	send(messages: ClientMessage | ClientMessage[]): Promise<ServerMessage[]>;

	/**
	 * Removes a previously registered sensor subscription.
	 *
	 * @param key - The subscription key to unregister
	 */
	unregisterSensorSubscription(key: string): void;
}

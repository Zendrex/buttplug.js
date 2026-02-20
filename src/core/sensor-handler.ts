import type { Logger } from "../lib/logger";
import type { ClientMessage, InputReading, InputType, ServerMessage } from "../protocol/schema";
import type { SensorCallback } from "../protocol/types";

import { sensorKey } from "../protocol/types";

/**
 * Internal state for a single sensor subscription.
 * Stores the callback and coordinate triple needed to match incoming readings.
 */
interface SensorSubscription {
	callback: SensorCallback;
	deviceIndex: number;
	featureIndex: number;
	type: InputType;
}

/**
 * Minimal router interface for sending unsubscribe commands.
 * Avoids coupling SensorHandler to the full MessageRouter.
 */
interface SensorRouter {
	nextId(): number;
	send(messages: ClientMessage | ClientMessage[]): Promise<ServerMessage[]>;
}

/**
 * Manages sensor subscriptions and routes incoming sensor readings to callbacks.
 *
 * Tracks active subscriptions by a composite key (device index, feature index, input type)
 * and dispatches matching readings directly to the registered callback. Unmatched readings
 * are forwarded to a fallback emitter.
 */
export class SensorHandler {
	/** Active subscriptions keyed by composite sensor key. */
	readonly #subscriptions = new Map<string, SensorSubscription>();
	readonly #logger: Logger;

	/**
	 * @param logger - Logger instance for subscription lifecycle events
	 */
	constructor(logger: Logger) {
		this.#logger = logger.child("sensor");
	}

	/**
	 * Registers a callback for a specific sensor on a device.
	 *
	 * @param key - Composite sensor key from {@link sensorKey}
	 * @param callback - Function invoked with the sensor value on each reading
	 * @param info - Device index, feature index, and input type for the sensor
	 * @throws {Error} if a subscription already exists for the given key
	 */
	register(
		key: string,
		callback: SensorCallback,
		info: { deviceIndex: number; featureIndex: number; type: InputType }
	): void {
		if (this.#subscriptions.has(key)) {
			throw new Error(`Sensor subscription already exists: ${key}. Unsubscribe before re-subscribing.`);
		}
		this.#subscriptions.set(key, { callback, ...info });
		this.#logger.debug(`Registered sensor subscription: ${key}`);
	}

	/**
	 * Removes a sensor subscription by key.
	 *
	 * @param key - Composite sensor key to unregister
	 */
	unregister(key: string): void {
		this.#subscriptions.delete(key);
		this.#logger.debug(`Unregistered sensor subscription: ${key}`);
	}

	/**
	 * Routes an incoming sensor reading to a matching subscription callback,
	 * or falls back to the provided emit function if no subscription matches.
	 *
	 * @param reading - The input reading from the server
	 * @param emit - Fallback emitter for unmatched readings
	 */
	handleReading(reading: InputReading, emit: (reading: InputReading) => void): void {
		const readingData = reading.Reading;
		const readingKey = Object.keys(readingData)[0];
		if (!(readingKey && readingKey in readingData)) {
			emit(reading);
			return;
		}
		// Type assertion safe: readingKey is a property of Reading which uses InputType as keys
		const type = readingKey as InputType;
		const subKey = sensorKey(reading.DeviceIndex, reading.FeatureIndex, type);
		const sub = this.#subscriptions.get(subKey);
		if (sub) {
			// Type assertion safe: readingData follows wire format with {Value: number} sensor values
			const wrapper = (readingData as Record<string, { Value: number }>)[type];
			if (wrapper !== undefined) {
				sub.callback(wrapper.Value);
				return;
			}
		}
		emit(reading);
	}

	/**
	 * Sends unsubscribe commands for all subscriptions on a device, then cleans up locally.
	 *
	 * If the client is disconnected, skips sending commands and only removes local state.
	 *
	 * @param options - Device index, router for sending commands, and connection status
	 */
	unsubscribeDevice(options: { deviceIndex: number; router: SensorRouter; connected: boolean }): void {
		const { deviceIndex, router, connected } = options;
		if (!connected) {
			this.cleanupDevice(deviceIndex);
			return;
		}
		try {
			for (const [, sub] of this.#subscriptions) {
				if (sub.deviceIndex === deviceIndex) {
					const id = router.nextId();
					router
						.send({
							InputCmd: {
								Id: id,
								DeviceIndex: sub.deviceIndex,
								FeatureIndex: sub.featureIndex,
								Type: sub.type,
								Command: "Unsubscribe",
							},
						})
						.catch(() => {
							// Ignore errors — device may already be gone
						});
				}
			}
		} finally {
			this.cleanupDevice(deviceIndex);
		}
	}

	/**
	 * Removes all local subscriptions for a device without sending unsubscribe commands.
	 *
	 * @param deviceIndex - Server-assigned index of the device to clean up
	 */
	cleanupDevice(deviceIndex: number): void {
		const keysToDelete: string[] = [];
		for (const [key, sub] of this.#subscriptions) {
			if (sub.deviceIndex === deviceIndex) {
				keysToDelete.push(key);
			}
		}
		for (const key of keysToDelete) {
			this.#subscriptions.delete(key);
			this.#logger.debug(`Cleaned up subscription on device removal: ${key}`);
		}
	}

	/** Removes all sensor subscriptions — used during client shutdown. */
	clear(): void {
		this.#subscriptions.clear();
	}
}

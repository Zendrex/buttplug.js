import { DeviceError } from "../lib/errors";
import { sensorKey } from "../protocol/shared";
import type { Logger } from "../lib/logger";
import type { ClientMessage, InputReading, InputType, ServerMessage } from "../protocol/schema";
import type { SensorCallback } from "../protocol/types";

interface SensorSubscription {
	callback: SensorCallback;
	deviceIndex: number;
	featureIndex: number;
	type: InputType;
}

interface SensorRouter {
	nextId(): number;
	send(messages: ClientMessage | ClientMessage[]): Promise<ServerMessage[]>;
}

export class SensorHandler {
	private readonly logger: Logger;
	private readonly subscriptions = new Map<string, SensorSubscription>();

	constructor(logger: Logger) {
		this.logger = logger.child("sensor");
	}

	register(
		key: string,
		callback: SensorCallback,
		info: { deviceIndex: number; featureIndex: number; type: InputType }
	): void {
		if (this.subscriptions.has(key)) {
			throw new DeviceError(
				info.deviceIndex,
				`Sensor subscription already exists: ${key}. Unsubscribe before re-subscribing.`
			);
		}
		this.subscriptions.set(key, { callback, ...info });
		this.logger.debug(`Registered sensor subscription: ${key}`);
	}

	unregister(key: string): void {
		this.subscriptions.delete(key);
		this.logger.debug(`Unregistered sensor subscription: ${key}`);
	}

	handleReading(reading: InputReading, emit: (reading: InputReading) => void): void {
		const readingData = reading.Reading;
		const readingKey = Object.keys(readingData)[0];
		if (!readingKey) {
			emit(reading);
			return;
		}
		const type = readingKey as InputType;
		const subKey = sensorKey(reading.DeviceIndex, reading.FeatureIndex, type);
		const sub = this.subscriptions.get(subKey);
		if (sub) {
			const wrapper = (readingData as Record<string, { Value: number }>)[type];
			if (wrapper !== undefined) {
				sub.callback(wrapper.Value);
				return;
			}
		}
		emit(reading);
	}

	unsubscribeDevice(options: { deviceIndex: number; router: SensorRouter; connected: boolean }): void {
		const { deviceIndex, router, connected } = options;
		if (!connected) {
			this.cleanupDevice(deviceIndex);
			return;
		}
		try {
			for (const sub of this.subscriptions.values()) {
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
						.catch(() => undefined);
				}
			}
		} finally {
			this.cleanupDevice(deviceIndex);
		}
	}

	clear(): void {
		this.subscriptions.clear();
	}

	private cleanupDevice(deviceIndex: number): void {
		for (const [key, sub] of this.subscriptions) {
			if (sub.deviceIndex === deviceIndex) {
				this.subscriptions.delete(key);
				this.logger.debug(`Cleaned up subscription on device removal: ${key}`);
			}
		}
	}
}

import type { ReconcilableDevice, ReconcileOptions } from "./types";

import { noopLogger } from "../lib/logger";
import { featuresEqual } from "./utils";

/**
 * Diffs the current device map against an incoming raw device list and applies changes.
 *
 * Performs a three-way reconciliation: removes devices no longer present, updates devices
 * whose features have changed, and adds newly discovered devices. Invokes the appropriate
 * callback for each change, then emits the final device list.
 *
 * @typeParam T - The concrete device type being reconciled
 * @param options - Reconciliation configuration including current state, incoming data, and callbacks
 */
export function reconcileDevices<T extends ReconcilableDevice>(options: ReconcileOptions<T>): void {
	const { currentDevices, incomingRaw, createDevice, callbacks } = options;
	const logger = options.logger ?? noopLogger;
	const incomingIndices = new Set(incomingRaw.map((d) => d.DeviceIndex));
	const currentIndices = new Set(currentDevices.keys());

	for (const index of currentIndices) {
		if (!incomingIndices.has(index)) {
			const device = currentDevices.get(index);
			if (device) {
				logger.debug(`Device removed: ${device.name} (index ${index})`);
				currentDevices.delete(index);
				callbacks.onRemoved(device);
			}
		}
	}

	for (const rawDevice of incomingRaw) {
		if (currentIndices.has(rawDevice.DeviceIndex)) {
			const existingDevice = currentDevices.get(rawDevice.DeviceIndex);
			const newDevice = createDevice(rawDevice);
			if (existingDevice && !featuresEqual(existingDevice.features, newDevice.features)) {
				currentDevices.set(rawDevice.DeviceIndex, newDevice);
				logger.debug(`Device updated: ${newDevice.name} (index ${newDevice.index})`);
				callbacks.onUpdated(newDevice, existingDevice);
			}
		} else {
			const device = createDevice(rawDevice);
			currentDevices.set(rawDevice.DeviceIndex, device);
			logger.debug(`Device added: ${device.name} (index ${device.index})`);
			callbacks.onAdded(device);
		}
	}

	callbacks.onList(Array.from(currentDevices.values()));
}

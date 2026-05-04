import { noopLogger } from "../lib/logger";
import type { Logger } from "../lib/logger";
import type { DeviceFeatures, InputFeature, OutputFeature, RawDevice } from "../protocol/schema";

export interface ReconcilableDevice {
	readonly features: DeviceFeatures;
	readonly index: number;
	readonly name: string;
}

export interface ReconcileCallbacks<T extends ReconcilableDevice> {
	onAdded: (device: T) => void;
	onList: (devices: T[]) => void;
	onRemoved: (device: T) => void;
	onUpdated: (newDevice: T, oldDevice: T) => void;
}

export interface ReconcileOptions<T extends ReconcilableDevice> {
	callbacks: ReconcileCallbacks<T>;
	createDevice: (raw: RawDevice) => T;
	currentDevices: Map<number, T>;
	incomingRaw: RawDevice[];
	logger?: Logger;
}

function arraysEqualBy<T>(a: T[], b: T[], key: (item: T) => number, eq: (x: T, y: T) => boolean): boolean {
	if (a.length !== b.length) {
		return false;
	}
	const sortedA = [...a].sort((x, y) => key(x) - key(y));
	const sortedB = [...b].sort((x, y) => key(x) - key(y));
	return sortedA.every((x, i) => {
		const y = sortedB[i];
		return y !== undefined && eq(x, y);
	});
}

function outputFeatureEq(a: OutputFeature, b: OutputFeature): boolean {
	return (
		a.type === b.type &&
		a.index === b.index &&
		a.description === b.description &&
		a.range[0] === b.range[0] &&
		a.range[1] === b.range[1] &&
		a.durationRange?.[0] === b.durationRange?.[0] &&
		a.durationRange?.[1] === b.durationRange?.[1]
	);
}

function inputFeatureEq(a: InputFeature, b: InputFeature): boolean {
	return (
		a.type === b.type &&
		a.index === b.index &&
		a.description === b.description &&
		a.canRead === b.canRead &&
		a.canSubscribe === b.canSubscribe &&
		a.range[0] === b.range[0] &&
		a.range[1] === b.range[1]
	);
}

function featuresEqual(a: DeviceFeatures, b: DeviceFeatures): boolean {
	return (
		arraysEqualBy(a.outputs, b.outputs, (f) => f.index, outputFeatureEq) &&
		arraysEqualBy(a.inputs, b.inputs, (f) => f.index, inputFeatureEq)
	);
}

export function reconcileDevices<T extends ReconcilableDevice>(options: ReconcileOptions<T>): void {
	const { currentDevices, incomingRaw, createDevice, callbacks } = options;
	const log = (options.logger ?? noopLogger).child("reconcile");
	const incomingIndices = new Set(incomingRaw.map((d) => d.DeviceIndex));
	const currentIndices = new Set(currentDevices.keys());

	for (const [index, device] of currentDevices) {
		if (!incomingIndices.has(index)) {
			log.debug(`Device removed: ${device.name} (index ${index})`);
			currentDevices.delete(index);
			callbacks.onRemoved(device);
		}
	}

	for (const rawDevice of incomingRaw) {
		if (currentIndices.has(rawDevice.DeviceIndex)) {
			const existingDevice = currentDevices.get(rawDevice.DeviceIndex);
			const newDevice = createDevice(rawDevice);
			if (existingDevice && !featuresEqual(existingDevice.features, newDevice.features)) {
				currentDevices.set(rawDevice.DeviceIndex, newDevice);
				log.debug(`Device updated: ${newDevice.name} (index ${newDevice.index})`);
				callbacks.onUpdated(newDevice, existingDevice);
			}
		} else {
			const device = createDevice(rawDevice);
			currentDevices.set(rawDevice.DeviceIndex, device);
			log.debug(`Device added: ${device.name} (index ${device.index})`);
			callbacks.onAdded(device);
		}
	}

	callbacks.onList(Array.from(currentDevices.values()));
}

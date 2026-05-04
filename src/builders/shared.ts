import { DeviceError } from "../lib/errors";
import type { OutputFeature } from "../protocol/schema";

export function assertNonEmpty<T>(values: T[], deviceIndex: number): void {
	if (values.length === 0) {
		throw new DeviceError(deviceIndex, "Values array must not be empty");
	}
}

export function findFeatureOrThrow(
	features: OutputFeature[],
	index: number,
	deviceIndex: number,
	label: string
): OutputFeature {
	const feature = features.find((f) => f.index === index);
	if (!feature) {
		throw new DeviceError(deviceIndex, `${label} feature index ${index} not found on device`);
	}
	return feature;
}

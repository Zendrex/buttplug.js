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

export function buildBatchMessages<E extends { index: number }, M>(
	input: number | E[],
	features: OutputFeature[],
	deviceIndex: number,
	errorLabel: string,
	fromEntry: (feature: OutputFeature, entry: E) => M,
	fromBroadcast: (feature: OutputFeature) => M
): M[] {
	if (Array.isArray(input)) {
		assertNonEmpty(input, deviceIndex);
		return input.map((entry) =>
			fromEntry(findFeatureOrThrow(features, entry.index, deviceIndex, errorLabel), entry)
		);
	}
	return features.map(fromBroadcast);
}

import { DeviceError } from "../lib/errors";
import type { OutputFeature } from "../protocol/schema";

export function buildBatchMessages<E extends { index: number }, M>(
	input: number | E[],
	features: OutputFeature[],
	deviceIndex: number,
	errorLabel: string,
	fromEntry: (feature: OutputFeature, entry: E) => M,
	fromBroadcast: (feature: OutputFeature) => M
): M[] {
	if (Array.isArray(input)) {
		if (input.length === 0) {
			throw new DeviceError(deviceIndex, "Values array must not be empty");
		}
		return input.map((entry) => {
			const feature = features.find((f) => f.index === entry.index);
			if (!feature) {
				throw new DeviceError(deviceIndex, `${errorLabel} feature index ${entry.index} not found on device`);
			}
			return fromEntry(feature, entry);
		});
	}
	return features.map(fromBroadcast);
}

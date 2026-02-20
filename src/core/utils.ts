import type { DeviceFeatures, InputFeature, OutputFeature } from "../protocol/schema";

import { TimeoutError } from "../lib/errors";

/**
 * Races a promise against a timeout, rejecting if the timeout expires first.
 *
 * @typeParam T - The resolved value type of the promise
 * @param promise - The promise to race
 * @param ms - Timeout duration in milliseconds
 * @returns The resolved value of the original promise
 * @throws {TimeoutError} if the deadline is exceeded
 */
export function raceTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return Promise.race([
		promise,
		new Promise<never>((_, reject) => setTimeout(() => reject(new TimeoutError("raceTimeout", ms)), ms)),
	]);
}

/**
 * Compares output features by sorting on index then checking all fields.
 * Sorts before comparing so feature order does not affect equality.
 *
 * @param a - First output feature array
 * @param b - Second output feature array
 * @returns true if both arrays contain structurally identical features
 */
function outputFeaturesEqual(a: OutputFeature[], b: OutputFeature[]): boolean {
	const sortedA = [...a].sort((x, y) => x.index - y.index);
	const sortedB = [...b].sort((x, y) => x.index - y.index);
	for (const [i, ao] of sortedA.entries()) {
		const bo = sortedB[i];
		if (
			!bo ||
			ao.type !== bo.type ||
			ao.index !== bo.index ||
			ao.description !== bo.description ||
			ao.range[0] !== bo.range[0] ||
			ao.range[1] !== bo.range[1] ||
			ao.durationRange?.[0] !== bo.durationRange?.[0] ||
			ao.durationRange?.[1] !== bo.durationRange?.[1]
		) {
			return false;
		}
	}
	return true;
}

/**
 * Compares input features by sorting on index then checking all fields.
 * Sorts before comparing so feature order does not affect equality.
 *
 * @param a - First input feature array
 * @param b - Second input feature array
 * @returns true if both arrays contain structurally identical features
 */
function inputFeaturesEqual(a: InputFeature[], b: InputFeature[]): boolean {
	const sortedA = [...a].sort((x, y) => x.index - y.index);
	const sortedB = [...b].sort((x, y) => x.index - y.index);
	for (const [i, ai] of sortedA.entries()) {
		const bi = sortedB[i];
		if (
			!bi ||
			ai.type !== bi.type ||
			ai.index !== bi.index ||
			ai.description !== bi.description ||
			ai.canRead !== bi.canRead ||
			ai.canSubscribe !== bi.canSubscribe ||
			ai.range[0] !== bi.range[0] ||
			ai.range[1] !== bi.range[1]
		) {
			return false;
		}
	}
	return true;
}

/**
 * Deep-compares two {@link DeviceFeatures} objects for structural equality.
 *
 * Sorts features by index before comparing, so order does not matter.
 *
 * @param a - First feature set
 * @param b - Second feature set
 * @returns true if both feature sets are structurally identical
 */
export function featuresEqual(a: DeviceFeatures, b: DeviceFeatures): boolean {
	if (a.outputs.length !== b.outputs.length || a.inputs.length !== b.inputs.length) {
		return false;
	}
	return outputFeaturesEqual(a.outputs, b.outputs) && inputFeaturesEqual(a.inputs, b.inputs);
}

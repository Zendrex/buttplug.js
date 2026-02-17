import type {
	DeviceFeatures,
	InputFeature,
	InputType,
	OutputFeature,
	OutputType,
	RawDevice,
	RawDeviceFeature,
	RawFeatureInput,
	RawFeatureOutput,
} from "../protocol/schema";

import { getLogger } from "../lib/context";
import { INPUT_TYPE_VALUES, OUTPUT_TYPE_VALUES } from "../protocol/schema";

/** All {@link OutputType} values defined by the buttplug protocol. */
export const OUTPUT_TYPES: readonly OutputType[] = OUTPUT_TYPE_VALUES;

/** All {@link InputType} values defined by the buttplug protocol. */
export const INPUT_TYPES: readonly InputType[] = INPUT_TYPE_VALUES;

/** Pre-indexed feature lookups cached per {@link DeviceFeatures} instance. */
const outputIndex = new WeakMap<DeviceFeatures, Map<OutputType, OutputFeature[]>>();
const inputIndex = new WeakMap<DeviceFeatures, Map<InputType, InputFeature[]>>();

/** Builds output type index for O(1) lookups. */
function buildOutputIndex(features: DeviceFeatures): Map<OutputType, OutputFeature[]> {
	const map = new Map<OutputType, OutputFeature[]>();
	for (const f of features.outputs) {
		const list = map.get(f.type);
		if (list) {
			list.push(f);
		} else {
			map.set(f.type, [f]);
		}
	}
	return map;
}

/** Builds input type index for O(1) lookups. */
function buildInputIndex(features: DeviceFeatures): Map<InputType, InputFeature[]> {
	const map = new Map<InputType, InputFeature[]>();
	for (const f of features.inputs) {
		const list = map.get(f.type);
		if (list) {
			list.push(f);
		} else {
			map.set(f.type, [f]);
		}
	}
	return map;
}

/** Lazily creates and caches output type index. */
function getOutputIndex(features: DeviceFeatures): Map<OutputType, OutputFeature[]> {
	let idx = outputIndex.get(features);
	if (!idx) {
		idx = buildOutputIndex(features);
		outputIndex.set(features, idx);
	}
	return idx;
}

/** Lazily creates and caches input type index. */
function getInputIndex(features: DeviceFeatures): Map<InputType, InputFeature[]> {
	let idx = inputIndex.get(features);
	if (!idx) {
		idx = buildInputIndex(features);
		inputIndex.set(features, idx);
	}
	return idx;
}

const KNOWN_OUTPUT_KEYS = new Set<string>(OUTPUT_TYPES);
const KNOWN_INPUT_KEYS = new Set<string>(INPUT_TYPES);

/** Extracts and validates output features from raw device data. */
function collectOutputs(feature: RawDeviceFeature): OutputFeature[] {
	if (!feature.Output) {
		return [];
	}
	const logger = getLogger();
	const results: OutputFeature[] = [];
	for (const key of Object.keys(feature.Output)) {
		if (!KNOWN_OUTPUT_KEYS.has(key)) {
			logger.warn(`Unknown output type "${key}" at feature index ${feature.FeatureIndex}, skipping`);
		}
	}
	for (const outputType of OUTPUT_TYPES) {
		const outputConfig = feature.Output[outputType];
		if (outputConfig) {
			results.push(parseOutputFeature(outputType, feature.FeatureIndex, feature, outputConfig));
		}
	}
	return results;
}

/** Extracts and validates input features from raw device data. */
function collectInputs(feature: RawDeviceFeature): InputFeature[] {
	if (!feature.Input) {
		return [];
	}
	const logger = getLogger();
	const results: InputFeature[] = [];
	for (const key of Object.keys(feature.Input)) {
		if (!KNOWN_INPUT_KEYS.has(key)) {
			logger.warn(`Unknown input type "${key}" at feature index ${feature.FeatureIndex}, skipping`);
		}
	}
	for (const inputType of INPUT_TYPES) {
		const inputConfig = feature.Input[inputType];
		if (inputConfig) {
			results.push(parseInputFeature(inputType, feature.FeatureIndex, feature, inputConfig));
		}
	}
	return results;
}

/**
 * Parses a {@link RawDevice} into a typed {@link DeviceFeatures} structure
 * with pre-built type indexes for O(1) capability lookups.
 *
 * Features are sorted by their FeatureIndex to ensure consistent ordering.
 * Unknown feature types are logged as warnings and skipped.
 *
 * @param raw - The raw device descriptor from the server
 * @returns Parsed and indexed device features
 */
export function parseFeatures(raw: RawDevice): DeviceFeatures {
	const outputs: OutputFeature[] = [];
	const inputs: InputFeature[] = [];

	const features = raw.DeviceFeatures ?? {};

	const sortedFeatures = Object.values(features).sort((a, b) => a.FeatureIndex - b.FeatureIndex);

	for (const feature of sortedFeatures) {
		for (const output of collectOutputs(feature)) {
			outputs.push(output);
		}
		for (const input of collectInputs(feature)) {
			inputs.push(input);
		}
	}

	const result: DeviceFeatures = { outputs, inputs };

	// Pre-build type indexes at parse time for O(1) lookups
	outputIndex.set(result, buildOutputIndex(result));
	inputIndex.set(result, buildInputIndex(result));

	return result;
}

/** Converts raw output feature to typed {@link OutputFeature}. */
function parseOutputFeature(
	type: OutputType,
	index: number,
	feature: RawDeviceFeature,
	output: RawFeatureOutput
): OutputFeature {
	return {
		type,
		index,
		description: feature.FeatureDescription,
		range: output.Value,
		durationRange: output.Duration,
	};
}

/**
 * Converts a raw input feature entry into a typed {@link InputFeature}.
 *
 * Intiface Central sends `Value` as an array of `[min, max]` tuples.
 * We extract the first tuple as the feature's range.
 */
function parseInputFeature(
	type: InputType,
	index: number,
	feature: RawDeviceFeature,
	input: RawFeatureInput
): InputFeature {
	const canRead = input.Command.includes("Read");
	const canSubscribe = input.Command.includes("Subscribe");
	const range = input.Value[0] ?? [0, 0];

	return {
		type,
		index,
		description: feature.FeatureDescription,
		range,
		canRead,
		canSubscribe,
	};
}

/**
 * Checks whether the device supports the given output type.
 *
 * @param features - The parsed device features
 * @param type - The output type to check for
 */
export function hasOutputType(features: DeviceFeatures, type: OutputType): boolean {
	const idx = getOutputIndex(features);
	const list = idx.get(type);
	return list !== undefined && list.length > 0;
}

/**
 * Checks whether the device supports the given input type.
 *
 * @param features - The parsed device features
 * @param type - The input type to check for
 */
export function hasInputType(features: DeviceFeatures, type: InputType): boolean {
	const idx = getInputIndex(features);
	const list = idx.get(type);
	return list !== undefined && list.length > 0;
}

/**
 * Returns all output features of the given type.
 *
 * @param features - The parsed device features
 * @param type - The output type to filter by
 */
export function getOutputsByType(features: DeviceFeatures, type: OutputType): OutputFeature[] {
	return getOutputIndex(features).get(type) ?? [];
}

/**
 * Returns all input features of the given type.
 *
 * @param features - The parsed device features
 * @param type - The input type to filter by
 */
export function getInputsByType(features: DeviceFeatures, type: InputType): InputFeature[] {
	return getInputIndex(features).get(type) ?? [];
}

/** @see {@link getOutputsByType} */
export function getOutputCapabilities(features: DeviceFeatures, type: OutputType): OutputFeature[] {
	return getOutputsByType(features, type);
}

/** @see {@link getInputsByType} */
export function getInputCapabilities(features: DeviceFeatures, type: InputType): InputFeature[] {
	return getInputsByType(features, type);
}

/** @see {@link hasOutputType} */
export function canOutput(features: DeviceFeatures, type: OutputType): boolean {
	return hasOutputType(features, type);
}

/**
 * Checks whether the device supports reading the given sensor type.
 *
 * @param features - The parsed device features
 * @param type - The input type to check
 */
export function canRead(features: DeviceFeatures, type: InputType): boolean {
	return getInputsByType(features, type).some((f) => f.canRead);
}

/**
 * Checks whether the device supports subscribing to the given sensor type.
 *
 * @param features - The parsed device features
 * @param type - The input type to check
 */
export function canSubscribe(features: DeviceFeatures, type: InputType): boolean {
	return getInputsByType(features, type).some((f) => f.canSubscribe);
}

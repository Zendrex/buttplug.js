import { noopLogger } from "../lib/logger";
import { INPUT_TYPE_VALUES, OUTPUT_TYPE_VALUES } from "./schema";
import type { Logger } from "../lib/logger";
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
} from "./schema";

export const OUTPUT_TYPES: readonly OutputType[] = OUTPUT_TYPE_VALUES;
export const INPUT_TYPES: readonly InputType[] = INPUT_TYPE_VALUES;

const KNOWN_OUTPUT_KEYS = new Set<string>(OUTPUT_TYPES);
const KNOWN_INPUT_KEYS = new Set<string>(INPUT_TYPES);

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

function collectOutputs(feature: RawDeviceFeature, logger: Logger): OutputFeature[] {
	if (!feature.Output) {
		return [];
	}
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

function collectInputs(feature: RawDeviceFeature, logger: Logger): InputFeature[] {
	if (!feature.Input) {
		return [];
	}
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

export function parseFeatures(raw: RawDevice, logger: Logger = noopLogger): DeviceFeatures {
	const log = logger.child("features");
	const outputs: OutputFeature[] = [];
	const inputs: InputFeature[] = [];

	const features = raw.DeviceFeatures ?? {};

	const sortedFeatures = Object.values(features).sort((a, b) => a.FeatureIndex - b.FeatureIndex);

	for (const feature of sortedFeatures) {
		for (const output of collectOutputs(feature, log)) {
			outputs.push(output);
		}
		for (const input of collectInputs(feature, log)) {
			inputs.push(input);
		}
	}

	return { outputs, inputs };
}

export function hasOutputType(features: DeviceFeatures, type: OutputType): boolean {
	return features.outputs.some((output) => output.type === type);
}

export function outputsByType(features: DeviceFeatures, type: OutputType): OutputFeature[] {
	return features.outputs.filter((output) => output.type === type);
}

export function inputsByType(features: DeviceFeatures, type: InputType): InputFeature[] {
	return features.inputs.filter((input) => input.type === type);
}

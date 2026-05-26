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

class DeviceFeaturesIndex {
	private readonly outputIndex = new WeakMap<DeviceFeatures, Map<OutputType, OutputFeature[]>>();
	private readonly inputIndex = new WeakMap<DeviceFeatures, Map<InputType, InputFeature[]>>();

	parseFeatures(raw: RawDevice, logger: Logger = noopLogger): DeviceFeatures {
		const outputs: OutputFeature[] = [];
		const inputs: InputFeature[] = [];

		const features = raw.DeviceFeatures ?? {};

		const sortedFeatures = Object.values(features).sort((a, b) => a.FeatureIndex - b.FeatureIndex);

		for (const feature of sortedFeatures) {
			for (const output of this.collectOutputs(feature, logger)) {
				outputs.push(output);
			}
			for (const input of this.collectInputs(feature, logger)) {
				inputs.push(input);
			}
		}

		const result: DeviceFeatures = { outputs, inputs };

		this.outputIndex.set(result, this.buildIndexByType(outputs));
		this.inputIndex.set(result, this.buildIndexByType(inputs));

		return result;
	}

	hasOutputType(features: DeviceFeatures, type: OutputType): boolean {
		return this.getOutputIndex(features).has(type);
	}

	outputsByType(features: DeviceFeatures, type: OutputType): OutputFeature[] {
		return this.getOutputIndex(features).get(type) ?? [];
	}

	inputsByType(features: DeviceFeatures, type: InputType): InputFeature[] {
		return this.getInputIndex(features).get(type) ?? [];
	}

	private buildIndexByType<T extends string, F extends { type: T }>(items: readonly F[]): Map<T, F[]> {
		const map = new Map<T, F[]>();
		for (const item of items) {
			const list = map.get(item.type);
			if (list) {
				list.push(item);
			} else {
				map.set(item.type, [item]);
			}
		}
		return map;
	}

	private indexFor<T extends string, F extends { type: T }>(
		cache: WeakMap<DeviceFeatures, Map<T, F[]>>,
		features: DeviceFeatures,
		items: readonly F[]
	): Map<T, F[]> {
		let idx = cache.get(features);
		if (!idx) {
			idx = this.buildIndexByType(items);
			cache.set(features, idx);
		}
		return idx;
	}

	private getOutputIndex(features: DeviceFeatures): Map<OutputType, OutputFeature[]> {
		return this.indexFor(this.outputIndex, features, features.outputs);
	}

	private getInputIndex(features: DeviceFeatures): Map<InputType, InputFeature[]> {
		return this.indexFor(this.inputIndex, features, features.inputs);
	}

	private collectOutputs(feature: RawDeviceFeature, logger: Logger): OutputFeature[] {
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
				results.push(this.parseOutputFeature(outputType, feature.FeatureIndex, feature, outputConfig));
			}
		}
		return results;
	}

	private collectInputs(feature: RawDeviceFeature, logger: Logger): InputFeature[] {
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
				results.push(this.parseInputFeature(inputType, feature.FeatureIndex, feature, inputConfig));
			}
		}
		return results;
	}

	private parseOutputFeature(
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

	private parseInputFeature(
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
}

const deviceFeaturesIndex = new DeviceFeaturesIndex();

export function parseFeatures(raw: RawDevice, logger: Logger = noopLogger): DeviceFeatures {
	return deviceFeaturesIndex.parseFeatures(raw, logger.child("features"));
}

export function hasOutputType(features: DeviceFeatures, type: OutputType): boolean {
	return deviceFeaturesIndex.hasOutputType(features, type);
}

export function outputsByType(features: DeviceFeatures, type: OutputType): OutputFeature[] {
	return deviceFeaturesIndex.outputsByType(features, type);
}

export function inputsByType(features: DeviceFeatures, type: InputType): InputFeature[] {
	return deviceFeaturesIndex.inputsByType(features, type);
}

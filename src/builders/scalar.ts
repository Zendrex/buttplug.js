import { validateRange } from "../lib/range";
import { buildBatchMessages } from "./shared";
import type { ClientMessage, FeatureValue, OutputCommand, OutputFeature, OutputType } from "../protocol/schema";
import type { DeviceMessageSender } from "../protocol/types";

export interface ScalarOutputMessageOptions {
	client: DeviceMessageSender;
	deviceIndex: number;
	feature: OutputFeature;
	type: OutputType;
	value: number;
}

export function buildScalarOutputMessage(options: ScalarOutputMessageOptions): ClientMessage {
	const { client, deviceIndex, feature, type, value } = options;
	const validatedValue = validateRange(value, feature.range);
	return {
		OutputCmd: {
			Id: client.nextId(),
			DeviceIndex: deviceIndex,
			FeatureIndex: feature.index,
			Command: { [type]: { Value: validatedValue } } as OutputCommand,
		},
	};
}

export interface ScalarOutputMessagesOptions {
	client: DeviceMessageSender;
	deviceIndex: number;
	errorLabel: string;
	features: OutputFeature[];
	type: OutputType;
	values: number | FeatureValue[];
}

export function buildScalarOutputMessages(options: ScalarOutputMessagesOptions): ClientMessage[] {
	const { client, deviceIndex, errorLabel, features, type, values } = options;
	return buildBatchMessages(
		values,
		features,
		deviceIndex,
		errorLabel,
		(feature, entry) => buildScalarOutputMessage({ client, deviceIndex, feature, type, value: entry.value }),
		(feature) => buildScalarOutputMessage({ client, deviceIndex, feature, type, value: values as number })
	);
}

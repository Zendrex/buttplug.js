import { DeviceError } from "../lib/errors";
import { mapToRange, validateRange } from "../lib/range";
import { buildBatchMessages } from "./shared";
import type { ClientMessage, OutputCommand, OutputFeature, OutputType, PositionValue } from "../protocol/schema";
import type { DeviceMessageSender } from "../protocol/types";

export interface PositionMessageOptions {
	client: DeviceMessageSender;
	deviceIndex: number;
	duration: number;
	feature: OutputFeature;
	position: number;
	positionType: OutputType;
}

export function buildPositionMessage(options: PositionMessageOptions): ClientMessage {
	const { client, deviceIndex, duration, feature, position, positionType } = options;

	if (positionType === "Position" && duration !== 0) {
		throw new DeviceError(
			deviceIndex,
			`Position output type does not support duration (got ${duration}ms). Use HwPositionWithDuration for timed movements.`
		);
	}

	const mappedValue = mapToRange(position, feature.range);
	const validatedDuration = feature.durationRange ? validateRange(duration, feature.durationRange) : duration;
	const command: OutputCommand =
		positionType === "HwPositionWithDuration"
			? { HwPositionWithDuration: { Position: mappedValue, Duration: validatedDuration } }
			: { Position: { Value: mappedValue } };
	const id = client.nextId();
	return {
		OutputCmd: {
			Id: id,
			DeviceIndex: deviceIndex,
			FeatureIndex: feature.index,
			Command: command,
		},
	};
}

export interface PositionMessagesOptions {
	client: DeviceMessageSender;
	deviceIndex: number;
	duration: number;
	features: OutputFeature[];
	position: number | PositionValue[];
	positionType: OutputType;
}

export function buildPositionMessages(options: PositionMessagesOptions): ClientMessage[] {
	const { client, deviceIndex, duration, features, position, positionType } = options;
	return buildBatchMessages(
		position,
		features,
		deviceIndex,
		"Position",
		(feature, entry) =>
			buildPositionMessage({
				client,
				deviceIndex,
				duration: entry.duration,
				feature,
				position: entry.position,
				positionType,
			}),
		(feature) =>
			buildPositionMessage({ client, deviceIndex, duration, feature, position: position as number, positionType })
	);
}

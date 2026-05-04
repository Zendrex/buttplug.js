import { DeviceError } from "../lib/errors";
import { validateRange } from "../lib/range";
import { assertNonEmpty, findFeatureOrThrow } from "./shared";
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

	const validatedValue = validateRange(position, feature.range);
	const validatedDuration = feature.durationRange ? validateRange(duration, feature.durationRange) : duration;
	const command: OutputCommand =
		positionType === "HwPositionWithDuration"
			? { HwPositionWithDuration: { Position: validatedValue, Duration: validatedDuration } }
			: { Position: { Value: validatedValue } };
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
	const messages: ClientMessage[] = [];

	if (Array.isArray(position)) {
		assertNonEmpty(position, deviceIndex);
		for (const entry of position) {
			const feature = findFeatureOrThrow(features, entry.index, deviceIndex, "Position");
			messages.push(
				buildPositionMessage({
					client,
					deviceIndex,
					duration: entry.duration,
					feature,
					position: entry.position,
					positionType,
				})
			);
		}
	} else {
		for (const feature of features) {
			messages.push(buildPositionMessage({ client, deviceIndex, duration, feature, position, positionType }));
		}
	}

	return messages;
}

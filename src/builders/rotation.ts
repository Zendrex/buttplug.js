import { validateRange } from "../lib/range";
import { buildBatchMessages } from "./shared";
import type { ClientMessage, OutputCommand, OutputFeature, OutputType, RotationValue } from "../protocol/schema";
import type { DeviceMessageSender } from "../protocol/types";

export interface RotateMessageOptions {
	client: DeviceMessageSender;
	clockwise: boolean;
	deviceIndex: number;
	feature: OutputFeature;
	rotationType: OutputType;
	speed: number;
}

export function buildRotateMessage(options: RotateMessageOptions): ClientMessage {
	const { client, clockwise, deviceIndex, feature, rotationType, speed } = options;
	const validatedValue = validateRange(speed, feature.range);
	const command: OutputCommand =
		rotationType === "RotateWithDirection"
			? { RotateWithDirection: { Value: validatedValue, Clockwise: clockwise } }
			: { Rotate: { Value: validatedValue } };
	return {
		OutputCmd: {
			Id: client.nextId(),
			DeviceIndex: deviceIndex,
			FeatureIndex: feature.index,
			Command: command,
		},
	};
}

export interface RotateMessagesOptions {
	client: DeviceMessageSender;
	clockwise: boolean;
	deviceIndex: number;
	features: OutputFeature[];
	rotationType: OutputType;
	speed: number | RotationValue[];
}

export function buildRotateMessages(options: RotateMessagesOptions): ClientMessage[] {
	const { client, clockwise, deviceIndex, features, rotationType, speed } = options;
	return buildBatchMessages(
		speed,
		features,
		deviceIndex,
		"Rotation",
		(feature, entry) =>
			buildRotateMessage({
				client,
				clockwise: entry.clockwise,
				deviceIndex,
				feature,
				rotationType,
				speed: entry.speed,
			}),
		(feature) =>
			buildRotateMessage({ client, clockwise, deviceIndex, feature, rotationType, speed: speed as number })
	);
}

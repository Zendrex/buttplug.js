import type {
	ClientMessage,
	FeatureValue,
	OutputCommand,
	OutputFeature,
	OutputType,
	PositionValue,
	RotationValue,
} from "../protocol/schema";
import type { DeviceMessageSender } from "../protocol/types";

import { DeviceError } from "../lib/errors";
import { validateRange } from "./validation";

/**
 * Options for building a single position command message.
 */
export interface PositionMessageOptions {
	/** Message sender used to generate unique message IDs. */
	client: DeviceMessageSender;
	/** Zero-based index of the target device. */
	deviceIndex: number;
	/** Movement duration in milliseconds. */
	duration: number;
	/** The output feature descriptor with range constraints. */
	feature: OutputFeature;
	/** Target position value, validated against the feature's range. */
	position: number;
	/** The position output type (e.g. "Position" or "HwPositionWithDuration"). */
	positionType: OutputType;
}

/**
 * Builds a single position {@link ClientMessage} for one feature.
 *
 * Validates the position and duration values against the feature's allowed ranges
 * before constructing the protocol message.
 *
 * @param options - Position message configuration
 * @returns The constructed output command message
 */
export function buildPositionMessage(options: PositionMessageOptions): ClientMessage {
	const { client, deviceIndex, positionType, feature, position, duration } = options;

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

/** Options for building position command messages across multiple features. */
export interface PositionMessagesOptions {
	client: DeviceMessageSender;
	deviceIndex: number;
	/** Movement duration in milliseconds (used when position is a uniform number). */
	duration: number;
	features: OutputFeature[];
	/** Uniform position value or per-feature {@link PositionValue} entries. */
	position: number | PositionValue[];
	positionType: OutputType;
}

/**
 * Builds position {@link ClientMessage} instances for multiple features.
 *
 * When given a uniform number, applies it to all features. When given an array
 * of {@link PositionValue} entries, targets specific features by index.
 *
 * @param options - Position messages configuration
 * @returns Array of constructed output command messages
 * @throws DeviceError if the values array is empty or contains invalid feature indices
 */
export function buildPositionMessages(options: PositionMessagesOptions): ClientMessage[] {
	const { client, deviceIndex, positionType, features, position, duration } = options;
	const messages: ClientMessage[] = [];

	if (Array.isArray(position)) {
		if (position.length === 0) {
			throw new DeviceError(deviceIndex, "Values array must not be empty");
		}
		for (const p of position) {
			const feature = features.find((f) => f.index === p.index);
			if (!feature) {
				throw new DeviceError(deviceIndex, `Position feature index ${p.index} not found on device`);
			}
			messages.push(
				buildPositionMessage({
					client,
					deviceIndex,
					positionType,
					feature,
					position: p.position,
					duration: p.duration,
				})
			);
		}
	} else {
		for (const feature of features) {
			messages.push(buildPositionMessage({ client, deviceIndex, positionType, feature, position, duration }));
		}
	}

	return messages;
}

/** Options for building rotation command messages across multiple features. */
export interface RotateMessagesOptions {
	client: DeviceMessageSender;
	/** Default rotation direction when using a uniform speed value. */
	clockwise: boolean;
	deviceIndex: number;
	features: OutputFeature[];
	rotationType: OutputType;
	/** Uniform speed value or per-feature {@link RotationValue} entries. */
	speed: number | RotationValue[];
}

/**
 * Builds rotation {@link ClientMessage} instances for multiple features.
 *
 * When given a uniform number, applies it to all features with the default direction.
 * When given an array of {@link RotationValue} entries, targets specific features
 * with per-feature speed and direction.
 *
 * @param options - Rotation messages configuration
 * @returns Array of constructed output command messages
 * @throws DeviceError if the values array is empty or contains invalid feature indices
 */
export function buildRotateMessages(options: RotateMessagesOptions): ClientMessage[] {
	const { client, deviceIndex, features, rotationType, speed, clockwise } = options;
	const messages: ClientMessage[] = [];

	if (Array.isArray(speed)) {
		if (speed.length === 0) {
			throw new DeviceError(deviceIndex, "Values array must not be empty");
		}
		for (const r of speed) {
			const feature = features.find((f) => f.index === r.index);
			if (!feature) {
				throw new DeviceError(deviceIndex, `Rotation feature index ${r.index} not found on device`);
			}
			const validatedValue = validateRange(r.speed, feature.range);
			const command: OutputCommand =
				rotationType === "RotateWithDirection"
					? { RotateWithDirection: { Value: validatedValue, Clockwise: r.clockwise } }
					: { Rotate: { Value: validatedValue } };
			const id = client.nextId();
			messages.push({
				OutputCmd: {
					Id: id,
					DeviceIndex: deviceIndex,
					FeatureIndex: feature.index,
					Command: command,
				},
			});
		}
	} else {
		for (const feature of features) {
			const validatedValue = validateRange(speed, feature.range);
			const command: OutputCommand =
				rotationType === "RotateWithDirection"
					? { RotateWithDirection: { Value: validatedValue, Clockwise: clockwise } }
					: { Rotate: { Value: validatedValue } };
			const id = client.nextId();
			messages.push({
				OutputCmd: {
					Id: id,
					DeviceIndex: deviceIndex,
					FeatureIndex: feature.index,
					Command: command,
				},
			});
		}
	}

	return messages;
}

/** Options for building scalar output command messages across multiple features. */
export interface ScalarOutputMessagesOptions {
	client: DeviceMessageSender;
	deviceIndex: number;
	/** Label for the feature type, used in error messages. */
	errorLabel: string;
	features: OutputFeature[];
	type: OutputType;
	/** Uniform value for all features, or per-feature {@link FeatureValue} entries. */
	values: number | FeatureValue[];
}

/**
 * Builds scalar output {@link ClientMessage} instances for multiple features.
 *
 * Handles uniform values (applied to all features) and per-feature value arrays.
 *
 * @param options - Scalar output messages configuration
 * @returns Array of constructed output command messages
 * @throws DeviceError if the values array is empty or exceeds the feature count
 */
export function buildScalarOutputMessages(options: ScalarOutputMessagesOptions): ClientMessage[] {
	const { client, deviceIndex, type, features, values, errorLabel } = options;

	if (Array.isArray(values)) {
		if (values.length === 0) {
			throw new DeviceError(deviceIndex, "Values array must not be empty");
		}
		const messages: ClientMessage[] = [];
		for (const entry of values) {
			const feature = features.find((f) => f.index === entry.index);
			if (!feature) {
				throw new DeviceError(deviceIndex, `${errorLabel} feature index ${entry.index} not found on device`);
			}
			const validatedValue = validateRange(entry.value, feature.range);
			const id = client.nextId();
			messages.push({
				OutputCmd: {
					Id: id,
					DeviceIndex: deviceIndex,
					FeatureIndex: feature.index,
					Command: { [type]: { Value: validatedValue } } as OutputCommand,
				},
			});
		}
		return messages;
	}

	const messages: ClientMessage[] = [];
	for (const feature of features) {
		const validatedValue = validateRange(values, feature.range);
		const id = client.nextId();
		messages.push({
			OutputCmd: {
				Id: id,
				DeviceIndex: deviceIndex,
				FeatureIndex: feature.index,
				Command: { [type]: { Value: validatedValue } } as OutputCommand,
			},
		});
	}
	return messages;
}

/** Sends an array of messages through the client. Skips empty arrays. */
export async function sendMessages(client: DeviceMessageSender, messages: ClientMessage[]): Promise<void> {
	if (messages.length === 0) {
		return;
	}
	await client.send(messages);
}

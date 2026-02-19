import type { Logger } from "./lib/logger";
import type {
	DeviceFeatures,
	FeatureValue,
	InputType,
	OutputType,
	PositionValue,
	RotationValue,
	ServerMessage,
} from "./protocol/schema";
import type { DeviceMessageSender, SensorCallback } from "./protocol/types";
import type { DeviceOptions, DeviceOutputOptions, DeviceStopOptions } from "./types";

import {
	buildPositionMessages,
	buildRotateMessages,
	buildScalarOutputMessages,
	sendMessages,
} from "./builders/commands";
import { getInputsByType, getOutputsByType, hasOutputType, parseFeatures } from "./builders/features";
import { validateRange } from "./builders/validation";
import { DeviceError } from "./lib/errors";
import { noopLogger } from "./lib/logger";
import { sensorKey } from "./protocol/types";

/**
 * Represents a single device connected to a Buttplug server.
 *
 * Provides typed methods for controlling outputs (vibration, rotation, position, etc.)
 * and reading or subscribing to input sensors. Constructed internally by {@link ButtplugClient}
 * when devices are discovered.
 */
export class Device {
	readonly #client: DeviceMessageSender;
	readonly #raw: DeviceOptions["raw"];
	readonly #features: DeviceFeatures;
	readonly #logger: Logger;
	#lastCommandTime = 0;

	constructor(options: DeviceOptions) {
		this.#client = options.client;
		this.#raw = options.raw;
		this.#logger = (options.logger ?? noopLogger).child("device");
		this.#features = parseFeatures(options.raw, this.#logger);
	}

	/**
	 * Sets vibration intensity on all or individual motors.
	 *
	 * @param intensity - A single value for all motors, or per-motor {@link FeatureValue} entries
	 * @throws DeviceError if the device does not support vibration
	 */
	async vibrate(intensity: number | FeatureValue[]): Promise<void> {
		await this.#sendScalarOutput({ type: "Vibrate", errorLabel: "vibration", values: intensity });
	}
	/**
	 * Sets oscillation speed on all or individual motors.
	 *
	 * @param speed - A single value for all motors, or per-motor {@link FeatureValue} entries
	 * @throws DeviceError if the device does not support oscillation
	 */
	async oscillate(speed: number | FeatureValue[]): Promise<void> {
		await this.#sendScalarOutput({ type: "Oscillate", errorLabel: "oscillation", values: speed });
	}
	/**
	 * Sets constriction pressure on all or individual actuators.
	 *
	 * @param value - A single value for all actuators, or per-actuator {@link FeatureValue} entries
	 * @throws DeviceError if the device does not support constriction
	 */
	async constrict(value: number | FeatureValue[]): Promise<void> {
		await this.#sendScalarOutput({ type: "Constrict", errorLabel: "constriction", values: value });
	}
	/**
	 * Controls spray output on all or individual actuators.
	 *
	 * @param value - A single value for all actuators, or per-actuator {@link FeatureValue} entries
	 * @throws DeviceError if the device does not support spraying
	 */
	async spray(value: number | FeatureValue[]): Promise<void> {
		await this.#sendScalarOutput({ type: "Spray", errorLabel: "spraying", values: value });
	}
	/**
	 * Sets temperature on all or individual actuators.
	 *
	 * @param value - A single value for all actuators, or per-actuator {@link FeatureValue} entries
	 * @throws DeviceError if the device does not support temperature control
	 */
	async temperature(value: number | FeatureValue[]): Promise<void> {
		await this.#sendScalarOutput({ type: "Temperature", errorLabel: "temperature control", values: value });
	}
	/**
	 * Controls LED brightness on all or individual actuators.
	 *
	 * @param value - A single value for all actuators, or per-actuator {@link FeatureValue} entries
	 * @throws DeviceError if the device does not support LED control
	 */
	async led(value: number | FeatureValue[]): Promise<void> {
		await this.#sendScalarOutput({ type: "Led", errorLabel: "LED control", values: value });
	}

	/**
	 * Sets rotation speed on per-motor {@link RotationValue} entries with individual direction.
	 *
	 * @param values - Per-motor rotation entries with speed and direction
	 * @throws DeviceError if the device does not support rotation
	 */
	async rotate(values: RotationValue[]): Promise<void>;
	/**
	 * Sets rotation speed (and optionally direction) on all motors.
	 *
	 * Automatically selects `RotateWithDirection` if the device supports it,
	 * falling back to `Rotate` otherwise.
	 *
	 * @param speed - A single speed for all motors
	 * @param options - Direction options (defaults to clockwise)
	 * @throws DeviceError if the device does not support rotation
	 */
	async rotate(speed: number, options?: { clockwise?: boolean }): Promise<void>;
	async rotate(speed: number | RotationValue[], options?: { clockwise?: boolean }): Promise<void> {
		this.#checkTimingGap();
		if (!this.canRotate) {
			throw new DeviceError(this.index, "Device does not support rotation");
		}
		const rotationType = hasOutputType(this.#features, "RotateWithDirection") ? "RotateWithDirection" : "Rotate";
		const features = getOutputsByType(this.#features, rotationType);
		const clockwise = options?.clockwise ?? true;
		const messages = buildRotateMessages({
			client: this.#client,
			deviceIndex: this.index,
			features,
			rotationType,
			speed,
			clockwise,
		});
		this.#logger.debug(`Rotate command: ${messages.length} motor(s) on device ${this.name}`);
		await sendMessages(this.#client, messages);
	}

	/**
	 * Moves per-axis {@link PositionValue} entries with individual durations.
	 *
	 * @param values - Per-axis position entries with position and duration
	 * @throws DeviceError if the device does not support position control
	 */
	async position(values: PositionValue[]): Promise<void>;
	/**
	 * Moves all axes to a uniform position over a given duration.
	 *
	 * Automatically selects `HwPositionWithDuration` if the device supports it,
	 * falling back to `Position` otherwise.
	 *
	 * @param position - A single position value for all axes
	 * @param options - Movement options including duration in milliseconds
	 * @throws DeviceError if the device does not support position control
	 */
	async position(position: number, options: { duration: number }): Promise<void>;
	async position(position: number | PositionValue[], options?: { duration?: number }): Promise<void> {
		this.#checkTimingGap();
		if (!this.canPosition) {
			throw new DeviceError(this.index, "Device does not support position control");
		}
		if (typeof position === "number" && options?.duration === undefined) {
			throw new DeviceError(this.index, "Duration is required when using a uniform position value");
		}
		const positionType = hasOutputType(this.#features, "HwPositionWithDuration")
			? "HwPositionWithDuration"
			: "Position";
		const features = getOutputsByType(this.#features, positionType);
		// Duration is per-entry when using PositionValue[], only used for uniform values
		// Fallback unreachable: guard above throws when duration is undefined for uniform values
		const duration = typeof position === "number" ? (options?.duration ?? 0) : 0;
		const messages = buildPositionMessages({
			client: this.#client,
			deviceIndex: this.index,
			positionType,
			features,
			position,
			duration,
		});
		this.#logger.debug(`Position command: ${messages.length} axis/axes on device ${this.name}`);
		await sendMessages(this.#client, messages);
	}

	/**
	 * Stops activity on this device.
	 *
	 * Can target a specific feature index or filter by input/output type.
	 * Without options, stops all features.
	 *
	 * @param options - Optional filters for which features to stop
	 * @throws DeviceError if the specified feature index does not exist
	 */
	async stop(options?: DeviceStopOptions): Promise<void> {
		this.#checkTimingGap();
		if (options?.featureIndex !== undefined) {
			const isOutput = this.#features.outputs.some((f) => f.index === options.featureIndex);
			const isInput = this.#features.inputs.some((f) => f.index === options.featureIndex);
			if (!(isOutput || isInput)) {
				throw new DeviceError(this.index, `No feature at index ${options.featureIndex}`);
			}
			// Validate that filter flags don't exclude the only applicable feature type
			if (isOutput && !isInput && options.outputs === false) {
				throw new DeviceError(
					this.index,
					`Feature at index ${options.featureIndex} is output-only, but outputs filter is false`
				);
			}
			if (isInput && !isOutput && options.inputs === false) {
				throw new DeviceError(
					this.index,
					`Feature at index ${options.featureIndex} is input-only, but inputs filter is false`
				);
			}
		}
		this.#logger.debug(`Stop command on device ${this.name} (index ${this.index})`);
		const id = this.#client.nextId();
		await this.#client.send({
			StopCmd: {
				Id: id,
				DeviceIndex: this.index,
				...(options?.featureIndex !== undefined && { FeatureIndex: options.featureIndex }),
				...(options?.inputs !== undefined && { Inputs: options.inputs }),
				...(options?.outputs !== undefined && { Outputs: options.outputs }),
			},
		});
	}

	/**
	 * Sends a raw output command to a specific feature.
	 *
	 * Values are validated against the feature's declared range and clamped if out of bounds.
	 *
	 * @param options - The feature index and output command payload
	 * @throws DeviceError if no matching output feature exists at the given index
	 */
	async output(options: DeviceOutputOptions): Promise<void> {
		this.#checkTimingGap();
		const { featureIndex, command } = options;
		// Type assertion safe: OutputCommand is a record with a single OutputType key
		const commandType = Object.keys(command)[0] as OutputType;
		const feature = this.#features.outputs.find((f) => f.index === featureIndex && f.type === commandType);
		if (!feature) {
			throw new DeviceError(this.index, `No "${commandType}" output feature at index ${featureIndex}`);
		}
		// All output types use object payloads — validate the relevant field
		const commandData = Object.values(command)[0] as Record<string, unknown>;
		if (commandType === "HwPositionWithDuration") {
			// Type assertion safe: HwPositionWithDuration data always has Position and Duration
			const data = commandData as { Position: number; Duration: number };
			data.Position = validateRange(data.Position, feature.range);
		} else {
			// All other types use {Value: number} (scalar types, RotateWithDirection)
			const data = commandData as { Value: number };
			data.Value = validateRange(data.Value, feature.range);
		}
		const validatedCommand = command;
		this.#logger.debug(`Output command: ${commandType} on device ${this.name} feature ${featureIndex}`);
		const id = this.#client.nextId();
		await this.#client.send({
			OutputCmd: {
				Id: id,
				DeviceIndex: this.index,
				FeatureIndex: featureIndex,
				Command: validatedCommand,
			},
		});
	}

	/**
	 * Performs a one-shot read of a sensor value.
	 *
	 * @param type - The sensor type to read (e.g. `"Battery"`, `"RSSI"`)
	 * @param sensorIndex - Index of the sensor if the device has multiple of the same type
	 * @returns The numeric sensor value
	 * @throws DeviceError if the sensor does not exist or does not support reading
	 */
	async readSensor(type: InputType, sensorIndex = 0): Promise<number> {
		const feature = this.#requireSensor({ type, sensorIndex, capability: "canRead" });
		const response = await this.#sendInputCmd({ featureIndex: feature.index, type, command: "Read" });
		if ("InputReading" in response) {
			const reading = response.InputReading.Reading;
			// Type assertion safe: reading is checked for the type key before access
			const wrapper = type in reading ? (reading as Record<string, { Value: number }>)[type] : undefined;
			if (wrapper !== undefined) {
				return wrapper.Value;
			}
		}
		throw new DeviceError(this.index, `Failed to read ${type} sensor: unexpected response`);
	}

	/**
	 * Subscribes to continuous sensor readings.
	 *
	 * @param type - The sensor type to subscribe to
	 * @param callback - Invoked each time a new reading arrives
	 * @param sensorIndex - Index of the sensor if the device has multiple of the same type
	 * @returns An async unsubscribe function that stops the subscription
	 * @throws DeviceError if the sensor does not exist or does not support subscriptions
	 */
	async subscribeSensor(type: InputType, callback: SensorCallback, sensorIndex = 0): Promise<() => Promise<void>> {
		const feature = this.#requireSensor({ type, sensorIndex, capability: "canSubscribe" });
		const subscriptionKey = sensorKey(this.index, feature.index, type);
		// Register locally only after the server confirms — avoids stale local state on rejection
		await this.#sendInputCmd({ featureIndex: feature.index, type, command: "Subscribe" });
		this.#client.registerSensorSubscription(subscriptionKey, callback, {
			deviceIndex: this.index,
			featureIndex: feature.index,
			type,
		});
		return async () => {
			this.#client.unregisterSensorSubscription(subscriptionKey);
			await this.#sendInputCmd({ featureIndex: feature.index, type, command: "Unsubscribe" });
		};
	}

	/**
	 * Explicitly unsubscribes from a sensor subscription by type and sensor index.
	 *
	 * @param type - The sensor type to unsubscribe from
	 * @param sensorIndex - Index of the sensor if the device has multiple of the same type
	 * @throws {DeviceError} if the sensor does not exist at the given index
	 */
	async unsubscribe(type: InputType, sensorIndex = 0): Promise<void> {
		const features = getInputsByType(this.#features, type);
		const feature = features[sensorIndex];
		if (!feature) {
			throw new DeviceError(this.index, `Device does not have ${type} sensor at index ${sensorIndex}`);
		}
		const subscriptionKey = sensorKey(this.index, feature.index, type);
		this.#client.unregisterSensorSubscription(subscriptionKey);
		await this.#sendInputCmd({ featureIndex: feature.index, type, command: "Unsubscribe" });
	}

	/**
	 * Checks whether this device supports a given output type.
	 *
	 * @param type - The output type to check
	 * @returns `true` if at least one feature supports the output type
	 */
	canOutput(type: OutputType): boolean {
		return hasOutputType(this.#features, type);
	}
	/**
	 * Checks whether this device can perform a one-shot read of a given sensor type.
	 *
	 * @param type - The input type to check
	 * @returns `true` if at least one matching sensor supports reading
	 */
	canRead(type: InputType): boolean {
		return getInputsByType(this.#features, type).some((f) => f.canRead);
	}
	/**
	 * Checks whether this device supports subscriptions for a given sensor type.
	 *
	 * @param type - The input type to check
	 * @returns `true` if at least one matching sensor supports subscriptions
	 */
	canSubscribe(type: InputType): boolean {
		return getInputsByType(this.#features, type).some((f) => f.canSubscribe);
	}

	/** Server-assigned device index. */
	get index(): number {
		return this.#raw.DeviceIndex;
	}
	/** Internal device name from firmware. */
	get name(): string {
		return this.#raw.DeviceName;
	}
	/** User-facing display name, or `null` if the server did not provide one. */
	get displayName(): string | null {
		return this.#raw.DeviceDisplayName ?? null;
	}
	/** Minimum interval in milliseconds between messages recommended by the server. */
	get messageTimingGap(): number {
		return this.#raw.DeviceMessageTimingGap;
	}
	/** Parsed input and output feature descriptors for this device. */
	get features(): DeviceFeatures {
		return this.#features;
	}
	/** Whether this device supports any form of rotation output. */
	get canRotate(): boolean {
		return this.canOutput("Rotate") || this.canOutput("RotateWithDirection");
	}
	/** Whether this device supports any form of position output. */
	get canPosition(): boolean {
		return this.canOutput("Position") || this.canOutput("HwPositionWithDuration");
	}

	/** Warns when commands are sent faster than the device's timing gap. */
	#checkTimingGap(): void {
		const gap = this.#raw.DeviceMessageTimingGap;
		if (gap <= 0) {
			return;
		}
		const now = Date.now();
		const elapsed = now - this.#lastCommandTime;
		if (this.#lastCommandTime > 0 && elapsed < gap) {
			this.#logger.warn(
				`Command sent ${elapsed}ms after previous (timing gap is ${gap}ms) — server may drop this command`
			);
		}
		this.#lastCommandTime = now;
	}

	/**
	 * Validates sensor existence and capability.
	 *
	 * @throws DeviceError if sensor doesn't exist or lacks the capability
	 */
	#requireSensor(params: { type: InputType; sensorIndex: number; capability: "canRead" | "canSubscribe" }) {
		const { type, sensorIndex, capability } = params;
		const features = getInputsByType(this.#features, type);
		const feature = features[sensorIndex];
		if (!feature) {
			throw new DeviceError(this.index, `Device does not have ${type} sensor at index ${sensorIndex}`);
		}
		const label = capability === "canRead" ? "reading" : "subscriptions";
		if (!feature[capability]) {
			throw new DeviceError(this.index, `${type} sensor at index ${sensorIndex} does not support ${label}`);
		}
		return feature;
	}

	/** Executes InputCmd and returns the server's first response. */
	async #sendInputCmd(params: {
		featureIndex: number;
		type: InputType;
		command: "Read" | "Subscribe" | "Unsubscribe";
	}): Promise<ServerMessage> {
		const { featureIndex, type, command } = params;
		const id = this.#client.nextId();
		const responses = await this.#client.send({
			InputCmd: { Id: id, DeviceIndex: this.index, FeatureIndex: featureIndex, Type: type, Command: command },
		});
		// Type assertion safe: server always returns at least one response per InputCmd
		return responses[0] as ServerMessage;
	}

	/**
	 * Sends scalar output commands after validating feature support.
	 *
	 * @throws DeviceError if the output type is not supported
	 */
	async #sendScalarOutput(params: {
		type: OutputType;
		errorLabel: string;
		values: number | FeatureValue[];
	}): Promise<void> {
		this.#checkTimingGap();
		const { type, errorLabel, values } = params;
		if (!this.canOutput(type)) {
			throw new DeviceError(this.index, `Device does not support ${errorLabel}`);
		}
		const features = getOutputsByType(this.#features, type);
		const messages = buildScalarOutputMessages({
			client: this.#client,
			deviceIndex: this.index,
			type,
			features,
			values,
			errorLabel,
		});
		this.#logger.debug(`${type} command: ${messages.length} actuator(s) on device ${this.name}`);
		await sendMessages(this.#client, messages);
	}
}

import { buildPositionMessages } from "./builders/position";
import { buildRotateMessages } from "./builders/rotation";
import { buildScalarOutputMessages } from "./builders/scalar";
import { DeviceError } from "./lib/errors";
import { noopLogger } from "./lib/logger";
import { validateRange } from "./lib/range";
import { hasOutputType, inputsByType, outputsByType, parseFeatures } from "./protocol/features";
import { createStopCmd } from "./protocol/messages";
import { sensorKey } from "./protocol/shared";
import type { Logger } from "./lib/logger";
import type {
	ClientMessage,
	DeviceFeatures,
	FeatureValue,
	InputType,
	OutputCommand,
	OutputType,
	PositionValue,
	RawDevice,
	RotationValue,
	ServerMessage,
} from "./protocol/schema";
import type { DeviceMessageSender, SensorCallback } from "./protocol/types";

export interface DeviceOptions {
	client: DeviceMessageSender;
	logger?: Logger;
	raw: RawDevice;
}

export interface DeviceStopOptions {
	featureIndex?: number;
	inputs?: boolean;
	outputs?: boolean;
}

export interface DeviceOutputOptions {
	command: OutputCommand;
	featureIndex: number;
}

export class Device {
	private readonly client: DeviceMessageSender;
	private readonly logger: Logger;
	private readonly _raw: DeviceOptions["raw"];
	private readonly _features: DeviceFeatures;

	constructor(options: DeviceOptions) {
		this.client = options.client;
		this.logger = (options.logger ?? noopLogger).child("device");
		this._raw = options.raw;
		this._features = parseFeatures(options.raw, this.logger);
	}

	get canRotate(): boolean {
		return this.canOutput("Rotate") || this.canOutput("RotateWithDirection");
	}

	get canPosition(): boolean {
		return this.canOutput("Position") || this.canOutput("HwPositionWithDuration");
	}

	get index(): number {
		return this._raw.DeviceIndex;
	}

	get name(): string {
		return this._raw.DeviceName;
	}

	get displayName(): string | null {
		return this._raw.DeviceDisplayName ?? null;
	}

	get features(): DeviceFeatures {
		return this._features;
	}

	get raw(): RawDevice {
		return this._raw;
	}

	canOutput(type: OutputType): boolean {
		return hasOutputType(this._features, type);
	}

	canRead(type: InputType): boolean {
		return inputsByType(this._features, type).some((f) => f.canRead);
	}

	canSubscribe(type: InputType): boolean {
		return inputsByType(this._features, type).some((f) => f.canSubscribe);
	}

	/**
	 * Vibrate all Vibrate-capable actuators at a normalized 0-1 intensity, or
	 * per-feature using a `FeatureValue[]` (each `value` 0-1). The library maps
	 * 0-1 to each feature's device range.
	 */
	async vibrate(intensity: number | FeatureValue[]): Promise<void> {
		await this.sendScalarOutput({ type: "Vibrate", errorLabel: "vibration", values: intensity });
	}

	/** Oscillate at a normalized 0-1 speed. See {@link Device.vibrate}. */
	async oscillate(speed: number | FeatureValue[]): Promise<void> {
		await this.sendScalarOutput({ type: "Oscillate", errorLabel: "oscillation", values: speed });
	}

	/** Constrict at a normalized 0-1 level. See {@link Device.vibrate}. */
	async constrict(value: number | FeatureValue[]): Promise<void> {
		await this.sendScalarOutput({ type: "Constrict", errorLabel: "constriction", values: value });
	}

	/** Spray at a normalized 0-1 level. See {@link Device.vibrate}. */
	async spray(value: number | FeatureValue[]): Promise<void> {
		await this.sendScalarOutput({ type: "Spray", errorLabel: "spraying", values: value });
	}

	/** Set temperature to a normalized 0-1 level. See {@link Device.vibrate}. */
	async temperature(value: number | FeatureValue[]): Promise<void> {
		await this.sendScalarOutput({ type: "Temperature", errorLabel: "temperature control", values: value });
	}

	/** Set LED brightness to a normalized 0-1 level. See {@link Device.vibrate}. */
	async led(value: number | FeatureValue[]): Promise<void> {
		await this.sendScalarOutput({ type: "Led", errorLabel: "LED control", values: value });
	}

	/**
	 * Rotate at a normalized 0-1 speed (clockwise by default), or per-feature
	 * using a `RotationValue[]` (each `speed` 0-1).
	 */
	async rotate(values: RotationValue[]): Promise<void>;
	async rotate(speed: number, options?: { clockwise?: boolean }): Promise<void>;
	async rotate(speed: number | RotationValue[], options?: { clockwise?: boolean }): Promise<void> {
		if (!this.canRotate) {
			throw new DeviceError(this.index, "Device does not support rotation");
		}
		const rotationType = hasOutputType(this._features, "RotateWithDirection") ? "RotateWithDirection" : "Rotate";
		const features = outputsByType(this._features, rotationType);
		const clockwise = options?.clockwise ?? true;
		const messages = buildRotateMessages({
			client: this.client,
			deviceIndex: this.index,
			features,
			rotationType,
			speed,
			clockwise,
		});
		this.logger.debug(`Rotate command: ${messages.length} motor(s) on device ${this.name}`);
		await this.sendMessages(messages);
	}

	/**
	 * Move to a normalized 0-1 position, or per-axis using a `PositionValue[]`
	 * (each `position` 0-1, `duration` ms). With `HwPositionWithDuration`
	 * features the move interpolates over `duration` milliseconds; plain
	 * `Position` features jump immediately and reject a nonzero duration.
	 */
	async position(values: PositionValue[]): Promise<void>;
	async position(position: number, options: { duration: number }): Promise<void>;
	async position(position: number | PositionValue[], options?: { duration?: number }): Promise<void> {
		if (!this.canPosition) {
			throw new DeviceError(this.index, "Device does not support position control");
		}
		if (typeof position === "number" && options?.duration === undefined) {
			throw new DeviceError(this.index, "Duration is required when using a uniform position value");
		}
		const positionType = hasOutputType(this._features, "HwPositionWithDuration")
			? "HwPositionWithDuration"
			: "Position";
		const features = outputsByType(this._features, positionType);
		const duration = typeof position === "number" ? (options?.duration ?? 0) : 0;
		const messages = buildPositionMessages({
			client: this.client,
			deviceIndex: this.index,
			positionType,
			features,
			position,
			duration,
		});
		this.logger.debug(`Position command: ${messages.length} axis/axes on device ${this.name}`);
		await this.sendMessages(messages);
	}

	async stop(options?: DeviceStopOptions): Promise<void> {
		this.validateStopTarget(options);
		this.logger.debug(`Stop command on device ${this.name} (index ${this.index})`);
		await this.client.send(
			createStopCmd(this.client.nextId(), {
				deviceIndex: this.index,
				featureIndex: options?.featureIndex,
				inputs: options?.inputs,
				outputs: options?.outputs,
			})
		);
	}

	/**
	 * Raw protocol escape hatch. Sends an `OutputCmd` with the exact command
	 * payload as defined by the Buttplug protocol — values are in the feature's
	 * device range (integers), NOT normalized 0-1. Prefer the typed methods
	 * (`vibrate`, `rotate`, `position`, …) for normal use.
	 */
	async output(options: DeviceOutputOptions): Promise<void> {
		const { featureIndex, command } = options;
		const commandType = Object.keys(command)[0] as OutputType;
		const feature = this._features.outputs.find((f) => f.index === featureIndex && f.type === commandType);
		if (!feature) {
			throw new DeviceError(this.index, `No "${commandType}" output feature at index ${featureIndex}`);
		}
		const originalData = Object.values(command)[0] as Record<string, unknown>;
		const validatedData = { ...originalData };
		if (commandType === "HwPositionWithDuration") {
			const data = validatedData as { Position: number; Duration: number };
			data.Position = validateRange(data.Position, feature.range);
		} else {
			const data = validatedData as { Value: number };
			data.Value = validateRange(data.Value, feature.range);
		}
		const validatedCommand = { [commandType]: validatedData } as OutputCommand;
		this.logger.debug(`Output command: ${commandType} on device ${this.name} feature ${featureIndex}`);
		const id = this.client.nextId();
		await this.client.send({
			OutputCmd: {
				Id: id,
				DeviceIndex: this.index,
				FeatureIndex: featureIndex,
				Command: validatedCommand,
			},
		});
	}

	async readSensor(type: InputType, sensorIndex = 0): Promise<number> {
		const feature = this.requireSensor({ type, sensorIndex, capability: "canRead" });
		const response = await this.sendInputCmd({ featureIndex: feature.index, type, command: "Read" });
		if ("InputReading" in response) {
			const reading = response.InputReading.Reading;
			const wrapper = type in reading ? (reading as Record<string, { Value: number }>)[type] : undefined;
			if (wrapper !== undefined) {
				return wrapper.Value;
			}
		}
		throw new DeviceError(this.index, `Failed to read ${type} sensor: unexpected response`);
	}

	async subscribeSensor(type: InputType, callback: SensorCallback, sensorIndex = 0): Promise<() => Promise<void>> {
		const feature = this.requireSensor({ type, sensorIndex, capability: "canSubscribe" });
		const subscriptionKey = sensorKey(this.index, feature.index, type);
		await this.sendInputCmd({ featureIndex: feature.index, type, command: "Subscribe" });
		this.client.registerSensor(subscriptionKey, callback, {
			deviceIndex: this.index,
			featureIndex: feature.index,
			type,
		});
		return async () => {
			this.client.unregisterSensor(subscriptionKey);
			await this.sendInputCmd({ featureIndex: feature.index, type, command: "Unsubscribe" });
		};
	}

	async unsubscribe(type: InputType, sensorIndex = 0): Promise<void> {
		const features = inputsByType(this._features, type);
		const feature = features[sensorIndex];
		if (!feature) {
			throw new DeviceError(this.index, `Device does not have ${type} sensor at index ${sensorIndex}`);
		}
		const subscriptionKey = sensorKey(this.index, feature.index, type);
		this.client.unregisterSensor(subscriptionKey);
		await this.sendInputCmd({ featureIndex: feature.index, type, command: "Unsubscribe" });
	}

	private validateStopTarget(options?: DeviceStopOptions): void {
		if (options?.featureIndex === undefined) {
			return;
		}
		const isOutput = this._features.outputs.some((f) => f.index === options.featureIndex);
		const isInput = this._features.inputs.some((f) => f.index === options.featureIndex);
		if (!(isOutput || isInput)) {
			throw new DeviceError(this.index, `No feature at index ${options.featureIndex}`);
		}
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

	private requireSensor(params: { type: InputType; sensorIndex: number; capability: "canRead" | "canSubscribe" }) {
		const { type, sensorIndex, capability } = params;
		const features = inputsByType(this._features, type);
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

	private async sendInputCmd(params: {
		featureIndex: number;
		type: InputType;
		command: "Read" | "Subscribe" | "Unsubscribe";
	}): Promise<ServerMessage> {
		const { featureIndex, type, command } = params;
		const id = this.client.nextId();
		const responses = await this.client.send({
			InputCmd: { Id: id, DeviceIndex: this.index, FeatureIndex: featureIndex, Type: type, Command: command },
		});
		return responses[0] as ServerMessage;
	}

	private async sendScalarOutput(params: {
		type: OutputType;
		errorLabel: string;
		values: number | FeatureValue[];
	}): Promise<void> {
		const { type, errorLabel, values } = params;
		if (!this.canOutput(type)) {
			throw new DeviceError(this.index, `Device does not support ${errorLabel}`);
		}
		const features = outputsByType(this._features, type);
		const messages = buildScalarOutputMessages({
			client: this.client,
			deviceIndex: this.index,
			type,
			features,
			values,
			errorLabel,
		});
		this.logger.debug(`${type} command: ${messages.length} actuator(s) on device ${this.name}`);
		await this.sendMessages(messages);
	}

	private async sendMessages(messages: ClientMessage[]): Promise<void> {
		if (messages.length === 0) {
			return;
		}
		await this.client.send(messages);
	}
}

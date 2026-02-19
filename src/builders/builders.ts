import type {
	ClientMessage,
	InputCommandType,
	InputType,
	OutputCmd,
	OutputCommand,
	OutputType,
	StopCmd,
} from "../protocol/schema";

import { validateRange } from "./validation";

/** Builder state for {@link OutputCommandBuilder}. */
interface OutputBuilderState {
	clockwise?: boolean;
	deviceIndex?: number;
	duration?: number;
	durationRange?: [number, number];
	featureIndex?: number;
	featureRange?: [number, number];
	id?: number;
	outputType?: OutputType;
	value?: number;
}

/**
 * Fluent builder for constructing output {@link ClientMessage} instances.
 *
 * Accumulates device target, feature index, output type, and value
 * through chained method calls, then produces a validated protocol message.
 */
export class OutputCommandBuilder {
	readonly #state: OutputBuilderState = {};

	/** Sets the message ID. Defaults to 0 if not called. */
	id(id: number): this {
		this.#state.id = id;
		return this;
	}

	/** Sets the target device index. */
	device(deviceIndex: number): this {
		this.#state.deviceIndex = deviceIndex;
		return this;
	}

	/** Sets the target feature index on the device. */
	feature(featureIndex: number): this {
		this.#state.featureIndex = featureIndex;
		return this;
	}

	/** Sets the allowed value range for clamping output values. */
	withRange(range: [number, number]): this {
		this.#state.featureRange = range;
		return this;
	}

	/** Sets the allowed duration range for clamping position command durations. */
	withDurationRange(range: [number, number]): this {
		this.#state.durationRange = range;
		return this;
	}

	/** Sets vibration intensity. */
	vibrate(value: number): this {
		this.#state.outputType = "Vibrate";
		this.#state.value = value;
		return this;
	}

	/** Sets rotation speed. */
	rotate(value: number): this {
		this.#state.outputType = "Rotate";
		this.#state.value = value;
		return this;
	}

	/** Sets rotation speed with direction. */
	rotateWithDirection(value: number, clockwise: boolean): this {
		this.#state.outputType = "RotateWithDirection";
		this.#state.value = value;
		this.#state.clockwise = clockwise;
		return this;
	}

	/** Sets oscillation intensity. */
	oscillate(value: number): this {
		this.#state.outputType = "Oscillate";
		this.#state.value = value;
		return this;
	}

	/** Sets constriction intensity. */
	constrict(value: number): this {
		this.#state.outputType = "Constrict";
		this.#state.value = value;
		return this;
	}

	/** Sets spray intensity. */
	spray(value: number): this {
		this.#state.outputType = "Spray";
		this.#state.value = value;
		return this;
	}

	/** Sets temperature value. */
	temperature(value: number): this {
		this.#state.outputType = "Temperature";
		this.#state.value = value;
		return this;
	}

	/** Sets LED intensity. */
	led(value: number): this {
		this.#state.outputType = "Led";
		this.#state.value = value;
		return this;
	}

	/** Sets target position. */
	position(value: number): this {
		this.#state.outputType = "Position";
		this.#state.value = value;
		return this;
	}

	/** Sets target position with movement duration in milliseconds. */
	hwPositionWithDuration(value: number, duration: number): this {
		this.#state.outputType = "HwPositionWithDuration";
		this.#state.value = value;
		this.#state.duration = duration;
		return this;
	}

	/**
	 * Validates accumulated state and produces a {@link ClientMessage}.
	 *
	 * @returns The constructed output command message
	 * @throws Error if deviceIndex, featureIndex, or output type/value are missing
	 * @throws Error if duration is missing for HwPositionWithDuration commands
	 */
	build(): ClientMessage {
		const { id, deviceIndex, featureIndex, outputType, value, clockwise, duration, featureRange, durationRange } =
			this.#state;

		if (deviceIndex === undefined) {
			throw new Error("OutputCommandBuilder: deviceIndex is required. Call .device(index) before .build().");
		}
		if (featureIndex === undefined) {
			throw new Error("OutputCommandBuilder: featureIndex is required. Call .feature(index) before .build().");
		}
		if (outputType === undefined || value === undefined) {
			throw new Error(
				"OutputCommandBuilder: output type and value are required. Call a command method (e.g. .vibrate(10)) before .build()."
			);
		}

		const validatedValue = featureRange ? validateRange(value, featureRange) : Math.round(value);

		let command: OutputCommand;

		switch (outputType) {
			case "RotateWithDirection": {
				command = {
					RotateWithDirection: {
						Value: validatedValue,
						Clockwise: clockwise ?? true,
					},
				};
				break;
			}
			case "HwPositionWithDuration": {
				if (duration === undefined) {
					throw new Error(
						"OutputCommandBuilder: duration is required for HwPositionWithDuration. Use .hwPositionWithDuration(value, duration)."
					);
				}
				const validatedDuration = durationRange ? validateRange(duration, durationRange) : Math.round(duration);
				command = {
					HwPositionWithDuration: {
						Position: validatedValue,
						Duration: validatedDuration,
					},
				};
				break;
			}
			default: {
				// Type assertion safe: outputType is guaranteed to be a simple scalar OutputType
				// (Vibrate, Oscillate, etc.) because the special cases (RotateWithDirection,
				// HwPositionWithDuration) are handled by explicit switch cases above
				command = { [outputType]: { Value: validatedValue } } as OutputCommand;
				break;
			}
		}

		const msg: OutputCmd = {
			Id: id ?? 0,
			DeviceIndex: deviceIndex,
			FeatureIndex: featureIndex,
			Command: command,
		};

		return { OutputCmd: msg };
	}
}

/** Builder state for {@link InputCommandBuilder}. */
interface InputBuilderState {
	command?: InputCommandType;
	deviceIndex?: number;
	featureIndex?: number;
	id?: number;
	inputType?: InputType;
}

/**
 * Fluent builder for constructing input {@link ClientMessage} instances.
 *
 * Supports read, subscribe, and unsubscribe commands for device sensors.
 */
export class InputCommandBuilder {
	readonly #state: InputBuilderState = {};

	/** Sets the message ID. Defaults to 0 if not called. */
	id(id: number): this {
		this.#state.id = id;
		return this;
	}

	/** Sets the target device index. */
	device(deviceIndex: number): this {
		this.#state.deviceIndex = deviceIndex;
		return this;
	}

	/** Sets the target feature index on the device. */
	feature(featureIndex: number): this {
		this.#state.featureIndex = featureIndex;
		return this;
	}

	/** Sets the command to read the given sensor type. */
	read(type: InputType): this {
		this.#state.inputType = type;
		this.#state.command = "Read";
		return this;
	}

	/** Sets the command to subscribe to the given sensor type. */
	subscribe(type: InputType): this {
		this.#state.inputType = type;
		this.#state.command = "Subscribe";
		return this;
	}

	/** Sets the command to unsubscribe from the given sensor type. */
	unsubscribe(type: InputType): this {
		this.#state.inputType = type;
		this.#state.command = "Unsubscribe";
		return this;
	}

	/**
	 * Validates accumulated state and produces a {@link ClientMessage}.
	 *
	 * @throws Error if deviceIndex, featureIndex, or input type/command are missing
	 */
	build(): ClientMessage {
		const { id, deviceIndex, featureIndex, inputType, command } = this.#state;

		if (deviceIndex === undefined) {
			throw new Error("InputCommandBuilder: deviceIndex is required. Call .device(index) before .build().");
		}
		if (featureIndex === undefined) {
			throw new Error("InputCommandBuilder: featureIndex is required. Call .feature(index) before .build().");
		}
		if (inputType === undefined || command === undefined) {
			throw new Error(
				"InputCommandBuilder: input type and command are required. Call .read(type), .subscribe(type), or .unsubscribe(type) before .build()."
			);
		}

		return {
			InputCmd: {
				Id: id ?? 0,
				DeviceIndex: deviceIndex,
				FeatureIndex: featureIndex,
				Type: inputType,
				Command: command,
			},
		};
	}
}

/** Builder state for {@link StopCommandBuilder}. */
interface StopBuilderState {
	deviceIndex?: number;
	featureIndex?: number;
	id?: number;
	stopInputs?: boolean;
	stopOutputs?: boolean;
}

/**
 * Fluent builder for constructing stop {@link ClientMessage} instances.
 *
 * Supports stopping all device activity or selectively stopping inputs and outputs.
 */
export class StopCommandBuilder {
	readonly #state: StopBuilderState = {};

	/** Sets the message ID. Defaults to 0 if not called. */
	id(id: number): this {
		this.#state.id = id;
		return this;
	}

	/** Sets the target device index. When omitted, the stop applies to all devices. */
	device(deviceIndex: number): this {
		this.#state.deviceIndex = deviceIndex;
		return this;
	}

	/** Sets the target feature index. Requires a device index to be set. */
	feature(featureIndex: number): this {
		this.#state.featureIndex = featureIndex;
		return this;
	}

	/** Sets whether to stop input subscriptions. */
	inputs(value: boolean): this {
		this.#state.stopInputs = value;
		return this;
	}

	/** Sets whether to stop output commands. */
	outputs(value: boolean): this {
		this.#state.stopOutputs = value;
		return this;
	}

	/**
	 * Produces a {@link ClientMessage} stop command from accumulated state.
	 *
	 * @throws Error if featureIndex is set without deviceIndex
	 */
	build(): ClientMessage {
		const { id, deviceIndex, featureIndex, stopInputs, stopOutputs } = this.#state;

		if (featureIndex !== undefined && deviceIndex === undefined) {
			throw new Error(
				"StopCommandBuilder: featureIndex requires deviceIndex. Call .device(index) before .feature(index)."
			);
		}

		const msg: StopCmd = { Id: id ?? 0 };

		if (deviceIndex !== undefined) {
			msg.DeviceIndex = deviceIndex;
			if (featureIndex !== undefined) {
				msg.FeatureIndex = featureIndex;
			}
		}

		if (stopInputs !== undefined) {
			msg.Inputs = stopInputs;
		}
		if (stopOutputs !== undefined) {
			msg.Outputs = stopOutputs;
		}

		return { StopCmd: msg };
	}
}

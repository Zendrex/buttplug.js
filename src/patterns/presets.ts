import type { OutputType } from "../protocol/schema";
import type { Keyframe, PresetInfo, PresetName } from "./types";

/**
 * Internal definition of a preset pattern, including its keyframe tracks
 * and compatible output types.
 */
interface PresetDefinition {
	/** Human-readable description of the pattern's behavior. */
	readonly description: string;
	/** Whether this preset loops by default. */
	readonly loop: boolean;
	/** {@link OutputType} values this preset is compatible with. */
	readonly outputTypes: OutputType[];
	/** Keyframe sequences for the pattern. Features are assigned tracks via round-robin when there are more features than tracks. */
	readonly tracks: Keyframe[][];
}

/** {@link OutputType} values driven by scalar intensity (motors, oscillators, constrictors). */
const MOTOR_OUTPUT_TYPES: OutputType[] = ["Vibrate", "Rotate", "RotateWithDirection", "Oscillate", "Constrict"];

/** {@link OutputType} values driven by position values (linear actuators). */
const POSITION_OUTPUT_TYPES: OutputType[] = ["Position", "HwPositionWithDuration"];

/**
 * Built-in pattern presets keyed by {@link PresetName}.
 *
 * Each preset defines keyframe tracks, compatible output types, and default loop behavior.
 * Presets are resolved into {@link ResolvedTrack} arrays by the track resolver.
 */
export const PRESETS: Record<PresetName, PresetDefinition> = {
	pulse: {
		description: "Square wave on/off",
		outputTypes: MOTOR_OUTPUT_TYPES,
		tracks: [
			[
				{ value: 0, duration: 0 },
				{ value: 1, duration: 0 },
				{ value: 1, duration: 500 },
				{ value: 0, duration: 0 },
				{ value: 0, duration: 500 },
			],
		],
		loop: true,
	},

	wave: {
		description: "Smooth sine wave oscillation",
		outputTypes: MOTOR_OUTPUT_TYPES,
		tracks: [
			[
				{ value: 0, duration: 0 },
				{ value: 0.5, duration: 500, easing: "easeInOut" },
				{ value: 1, duration: 500, easing: "easeInOut" },
				{ value: 0.5, duration: 500, easing: "easeInOut" },
				{ value: 0, duration: 500, easing: "easeInOut" },
			],
		],
		loop: true,
	},

	ramp_up: {
		description: "Gradual increase to maximum",
		outputTypes: MOTOR_OUTPUT_TYPES,
		tracks: [
			[
				{ value: 0, duration: 0 },
				{ value: 1, duration: 3000, easing: "easeIn" },
			],
		],
		loop: false,
	},

	ramp_down: {
		description: "Gradual decrease to zero",
		outputTypes: MOTOR_OUTPUT_TYPES,
		tracks: [
			[
				{ value: 1, duration: 0 },
				{ value: 0, duration: 3000, easing: "easeOut" },
			],
		],
		loop: false,
	},

	heartbeat: {
		description: "Ba-bump heartbeat rhythm",
		outputTypes: MOTOR_OUTPUT_TYPES,
		tracks: [
			[
				{ value: 0, duration: 0 },
				{ value: 1, duration: 0 },
				{ value: 1, duration: 100 },
				{ value: 0.3, duration: 50 },
				{ value: 0.8, duration: 0 },
				{ value: 0.8, duration: 100 },
				{ value: 0, duration: 0 },
				{ value: 0, duration: 750 },
			],
		],
		loop: true,
	},

	surge: {
		description: "Build to peak then release",
		outputTypes: MOTOR_OUTPUT_TYPES,
		tracks: [
			[
				{ value: 0.1, duration: 0 },
				{ value: 0.7, duration: 2000, easing: "easeIn" },
				{ value: 1, duration: 500 },
				{ value: 1, duration: 1000 },
				{ value: 0.1, duration: 1500, easing: "easeOut" },
			],
		],
		loop: false,
	},

	stroke: {
		description: "Full-range position strokes",
		outputTypes: POSITION_OUTPUT_TYPES,
		tracks: [
			[
				{ value: 0, duration: 0, easing: "easeInOut" },
				{ value: 1, duration: 1000, easing: "easeInOut" },
				{ value: 0, duration: 1000, easing: "easeInOut" },
			],
		],
		loop: true,
	},
};

/**
 * Returns metadata for all available preset patterns.
 *
 * @returns Array of {@link PresetInfo} with name, description, compatible types, and loop defaults
 */
export function getPresetInfo(): PresetInfo[] {
	return Object.entries(PRESETS).map(([name, def]) => ({
		name,
		description: def.description,
		compatibleOutputTypes: def.outputTypes,
		defaultLoop: def.loop,
	}));
}

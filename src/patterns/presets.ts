import { z } from "zod";

import type { OutputType } from "../protocol/schema";
import type { Keyframe } from "./keyframe";

export const PRESET_NAMES = ["pulse", "wave", "ramp_up", "ramp_down", "heartbeat", "surge", "stroke"] as const;

export type PresetName = (typeof PRESET_NAMES)[number];

export const PresetPatternSchema = z.object({
	type: z.literal("preset"),
	preset: z.enum(PRESET_NAMES),
	intensity: z.number().min(0).max(1).optional(),
	speed: z.number().min(0.25).max(4).optional(),
	loop: z.union([z.boolean(), z.number().int().positive()]).optional(),
});

export type PresetPattern = z.infer<typeof PresetPatternSchema>;

export interface PresetInfo {
	readonly compatibleOutputTypes: OutputType[];
	readonly defaultLoop: boolean;
	readonly description: string;
	readonly name: string;
}

interface PresetDefinition {
	readonly description: string;
	readonly loop: boolean;
	readonly outputTypes: OutputType[];
	readonly tracks: Keyframe[][];
}

const MOTOR_OUTPUT_TYPES: OutputType[] = ["Vibrate", "Rotate", "RotateWithDirection", "Oscillate", "Constrict"];

const POSITION_OUTPUT_TYPES: OutputType[] = ["Position", "HwPositionWithDuration"];

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

export function getPresetInfo(): PresetInfo[] {
	return Object.entries(PRESETS).map(([name, def]) => ({
		name,
		description: def.description,
		compatibleOutputTypes: def.outputTypes,
		defaultLoop: def.loop,
	}));
}

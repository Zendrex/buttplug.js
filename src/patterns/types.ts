import type { DeviceFeatures, OutputType } from "../protocol/schema";
import type { DeviceOutputOptions, DeviceStopOptions } from "../types";

import { z } from "zod";

import { OutputTypeSchema } from "../protocol/schema";

/**
 * Minimal device interface required by {@link PatternEngine}.
 *
 * Decouples the pattern system from the full client device implementation,
 * allowing patterns to target any object that can send {@link OutputCommand} messages.
 */
export interface PatternDevice {
	/** Available input/output features on the device. */
	readonly features: DeviceFeatures;
	/** Device index in the server's device list. */
	readonly index: number;
	/** Minimum interval in milliseconds between consecutive messages to this device. */
	readonly messageTimingGap: number;
	/** Human-readable device name. */
	readonly name: string;
	/**
	 * Sends an {@link OutputCommand} to a specific feature.
	 *
	 * @param options - The feature index and output command to send
	 */
	output(options: DeviceOutputOptions): Promise<void>;
	/**
	 * Stops device output.
	 *
	 * @param options - Optional filters for which features/directions to stop
	 */
	stop(options?: DeviceStopOptions): Promise<void>;
}

/** Supported {@link Easing} curve names. */
export const EASING_VALUES = ["linear", "easeIn", "easeOut", "easeInOut", "step"] as const;

/** Zod schema for validating {@link Easing} values. */
export const EasingSchema = z.enum(EASING_VALUES);

/** Easing curve identifier used for keyframe interpolation. */
export type Easing = z.infer<typeof EasingSchema>;

/** Zod schema for validating {@link Keyframe} objects. */
export const KeyframeSchema = z.object({
	value: z.number().min(0).max(1),
	duration: z.number().int().nonnegative(),
	easing: EasingSchema.optional(),
});

/**
 * A single animation keyframe with a target value, transition duration, and optional {@link Easing}.
 *
 * Duration of 0 creates an instant jump to the value.
 */
export type Keyframe = z.infer<typeof KeyframeSchema>;

/** Zod schema for validating {@link Track} objects. */
export const TrackSchema = z.object({
	featureIndex: z.number().int().nonnegative(),
	keyframes: z.array(KeyframeSchema).min(1),
	clockwise: z.boolean().optional(),
	outputType: OutputTypeSchema.optional(),
});

/** A sequence of {@link Keyframe} values bound to a specific device feature. */
export type Track = z.infer<typeof TrackSchema>;

/** Available built-in pattern preset names. */
export const PRESET_NAMES = ["pulse", "wave", "ramp_up", "ramp_down", "heartbeat", "surge", "stroke"] as const;

/** A built-in preset pattern name from {@link PRESET_NAMES}. */
export type PresetName = (typeof PRESET_NAMES)[number];

/** Zod schema for validating {@link PresetPattern} descriptors. */
export const PresetPatternSchema = z.object({
	type: z.literal("preset"),
	preset: z.enum(PRESET_NAMES),
	intensity: z.number().min(0).max(1).optional(),
	speed: z.number().min(0.25).max(4).optional(),
	loop: z.union([z.boolean(), z.number().int().positive()]).optional(),
});

/**
 * Pattern descriptor that references a built-in preset by name.
 *
 * Allows optional intensity scaling (0-1), speed multiplier (0.25-4x),
 * and loop configuration.
 */
export type PresetPattern = z.infer<typeof PresetPatternSchema>;

/** Zod schema for validating {@link CustomPattern} descriptors. */
export const CustomPatternSchema = z.object({
	type: z.literal("custom"),
	tracks: z.array(TrackSchema).min(1),
	intensity: z.number().min(0).max(1).optional(),
	loop: z.union([z.boolean(), z.number().int().positive()]).optional(),
});

/**
 * Pattern descriptor with user-defined keyframe tracks.
 *
 * Each track targets a specific feature index and contains its own keyframe sequence.
 */
export type CustomPattern = z.infer<typeof CustomPatternSchema>;

/**
 * Discriminated union schema for pattern descriptors.
 *
 * Uses the `type` field to distinguish between preset and custom patterns.
 */
export const PatternDescriptorSchema = z.discriminatedUnion("type", [PresetPatternSchema, CustomPatternSchema]);

/**
 * Pattern descriptor that can be either preset-based or custom-defined.
 */
export type PatternDescriptor = z.infer<typeof PatternDescriptorSchema>;

/**
 * A {@link Keyframe} after defaults have been applied and intensity scaling resolved.
 */
export interface ResolvedKeyframe {
	/** Transition duration in milliseconds. */
	readonly duration: number;
	/** {@link Easing} curve for interpolation toward this value. */
	readonly easing: Easing;
	/** Target value after intensity scaling. */
	readonly value: number;
}

/**
 * A fully resolved {@link Track} ready for scheduling.
 *
 * Contains the device feature binding, {@link ResolvedKeyframe} values with defaults applied,
 * and the feature's output range constraints.
 */
export interface ResolvedTrack {
	/** Rotation direction for RotateWithDirection outputs. */
	readonly clockwise: boolean;
	/** Min/max duration constraints for HwPositionWithDuration features. */
	readonly durationRange: [number, number] | undefined;
	/** Index of the target output feature on the device. */
	readonly featureIndex: number;
	/** {@link ResolvedKeyframe} values with defaults and intensity scaling applied. */
	readonly keyframes: ResolvedKeyframe[];
	/** {@link OutputType} determining which command to build. */
	readonly outputType: OutputType;
	/** Min/max range for output values from the feature spec. */
	readonly range: [number, number];
}

/**
 * Client interface consumed by {@link PatternEngine} for {@link PatternDevice} access and event subscription.
 *
 * Decouples the engine from the full buttplug client, requiring only device
 * lookup and disconnect/removal event hooks.
 */
export interface PatternEngineClient {
	/**
	 * Retrieves a {@link PatternDevice} by its server-assigned index.
	 *
	 * @param index - The device index to look up
	 * @returns The device if found, or undefined
	 */
	getDevice(index: number): PatternDevice | undefined;
	/**
	 * Subscribes to the client disconnected event.
	 *
	 * @param event - The event name
	 * @param handler - Callback invoked on disconnect
	 * @returns Unsubscribe function
	 */
	on(event: "disconnected", handler: (data: { reason?: string }) => void): () => void;
	/**
	 * Subscribes to the device removed event.
	 *
	 * @param event - The event name
	 * @param handler - Callback invoked when a {@link PatternDevice} is removed
	 * @returns Unsubscribe function
	 */
	on(event: "deviceRemoved", handler: (data: { device: PatternDevice }) => void): () => void;
}

/** Reason a pattern was stopped, used in {@link PatternPlayOptions.onStop} callbacks. */
export type StopReason = "manual" | "complete" | "timeout" | "error" | "disconnect" | "deviceRemoved";

/**
 * Unified options for controlling pattern playback behavior.
 *
 * Combines device targeting, preset tuning, loop control, timeout,
 * and lifecycle callbacks into a single options object.
 */
export interface PatternPlayOptions {
	/** Target a specific feature index instead of auto-resolving. */
	featureIndex?: number;
	/** Intensity scaling (0-1). Applied to preset and custom patterns. */
	intensity?: number;
	/** Loop behavior override. */
	loop?: boolean | number;
	/** Called when the pattern completes all loops naturally. */
	onComplete?: (patternId: string) => void;
	/** Called whenever the pattern stops for any {@link StopReason}. */
	onStop?: (patternId: string, reason: StopReason) => void;
	/** Speed multiplier (0.25-4x). Only applies to preset shorthand. */
	speed?: number;
	/** Maximum playback duration in milliseconds before auto-stop. */
	timeout?: number;
}

/**
 * @deprecated Use {@link PatternPlayOptions} instead.
 */
export type PlayOptions = PatternPlayOptions;

/**
 * Read-only snapshot of a running pattern, returned by {@link PatternEngine.list}.
 */
export interface PatternInfo {
	/** The original {@link PatternDescriptor} used to create this pattern. */
	readonly descriptor: PatternDescriptor;
	/** Index of the device this pattern targets. */
	readonly deviceIndex: number;
	/** Milliseconds elapsed since playback began. */
	readonly elapsed: number;
	/** Feature indices being driven by this pattern. */
	readonly featureIndices: number[];
	/** Unique pattern instance identifier. */
	readonly id: string;
	/** Timestamp (from `performance.now()`) when playback began. */
	readonly startedAt: number;
}

/**
 * Metadata describing a built-in preset pattern.
 */
export interface PresetInfo {
	/** {@link OutputType} values this preset is designed for. */
	readonly compatibleOutputTypes: OutputType[];
	/** Whether the preset loops by default. */
	readonly defaultLoop: boolean;
	/** Human-readable description of the pattern's behavior. */
	readonly description: string;
	/** Preset name identifier. */
	readonly name: string;
}

/**
 * Internal mutable state for an active pattern instance.
 *
 * Tracks scheduling timers, loop counters, and deduplication state
 * to avoid sending redundant commands to the device.
 */
export interface PatternState {
	/** The validated {@link PatternDescriptor}. */
	readonly descriptor: PatternDescriptor;
	/** Target device index. */
	readonly deviceIndex: number;
	/** Expected time of the next tick, used for drift correction. */
	expectedTickTime: number;
	/** Unique pattern instance identifier. */
	readonly id: string;
	/** Last sent keyframe index per feature index, for HwPosition deduplication. */
	readonly lastSentKeyframeIndex: Map<number, number>;
	/** Last sent scalar value per feature index, for deduplication. */
	readonly lastSentValues: Map<number, number>;
	/** Loop configuration from the descriptor. */
	readonly loop: boolean | number;
	/** {@link PatternPlayOptions} including callbacks and tuning. */
	readonly options: PatternPlayOptions;
	/** Remaining loop iterations (Infinity for indefinite). */
	remainingLoops: number;
	/** Handle for the safety timeout timer. */
	safetyTimerId: ReturnType<typeof setTimeout> | null;
	/** Timestamp of the current cycle's start, reset on each loop. */
	startedAt: number;
	/** Whether this pattern has been stopped. */
	stopped: boolean;
	/** Tick interval in milliseconds, derived from device timing gap. */
	readonly tickInterval: number;
	/** Handle for the next scheduled tick. */
	timerId: ReturnType<typeof setTimeout> | null;
	/** {@link ResolvedTrack} values for this pattern. */
	readonly tracks: ResolvedTrack[];
}

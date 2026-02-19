import type { OutputCommand } from "../protocol/schema";
import type { PatternDevice, PatternState, ResolvedKeyframe, ResolvedTrack } from "./types";

import { DeviceError } from "../lib/errors";
import { ease } from "./easing";

/**
 * Interpolates a normalized value (0-1) from a keyframe sequence at the given elapsed time.
 *
 * Walks through keyframes accumulating durations. Zero-duration keyframes create
 * instant jumps; non-zero durations interpolate between the previous and target
 * values using the keyframe's easing function.
 *
 * @param keyframes - Resolved keyframe sequence to evaluate
 * @param elapsed - Milliseconds elapsed since cycle start
 * @returns Interpolated value in the 0-1 range
 */
export function interpolateKeyframes(keyframes: ResolvedKeyframe[], elapsed: number): number {
	let accumulated = 0;
	const first = keyframes[0];
	if (!first) {
		return 0;
	}
	let value = first.value;

	for (const kf of keyframes) {
		if (kf.duration === 0) {
			if (elapsed >= accumulated) {
				value = kf.value;
			}
			continue;
		}

		const prevValue = value;
		if (elapsed < accumulated + kf.duration) {
			const t = (elapsed - accumulated) / kf.duration;
			const result = prevValue + (kf.value - prevValue) * ease(t, kf.easing);
			return Math.max(0, Math.min(1, result));
		}

		accumulated += kf.duration;
		value = kf.value;
	}

	return Math.max(0, Math.min(1, value));
}

/**
 * Builds an {@link OutputCommand} for a scalar-type track at the given value.
 *
 * Maps the track's output type to the corresponding protocol command structure.
 * Throws a {@link DeviceError} for unrecognized output types.
 *
 * @param track - The resolved track providing output type and direction
 * @param value - The scalar value to send
 * @returns The protocol output command
 * @throws DeviceError if the track's output type is not supported
 */
export function buildScalarCommand(track: ResolvedTrack, value: number): OutputCommand {
	switch (track.outputType) {
		case "Vibrate":
			return { Vibrate: { Value: value } };
		case "Rotate":
			return { Rotate: { Value: value } };
		case "RotateWithDirection":
			return { RotateWithDirection: { Value: value, Clockwise: track.clockwise } };
		case "Oscillate":
			return { Oscillate: { Value: value } };
		case "Constrict":
			return { Constrict: { Value: value } };
		case "Position":
			return { Position: { Value: value } };
		case "Spray":
			return { Spray: { Value: value } };
		case "Temperature":
			return { Temperature: { Value: value } };
		case "Led":
			return { Led: { Value: value } };
		default:
			throw new DeviceError(0, `Unsupported output type in pattern: ${track.outputType}`);
	}
}

/**
 * Calculates the total cycle duration across all tracks.
 *
 * Returns the maximum total keyframe duration among all tracks,
 * which determines when a loop cycle completes.
 *
 * @param tracks - Resolved tracks to measure
 * @returns Cycle duration in milliseconds
 */
export function getCycleDuration(tracks: ResolvedTrack[]): number {
	let max = 0;
	for (const track of tracks) {
		let total = 0;
		for (const kf of track.keyframes) {
			total += kf.duration;
		}
		if (total > max) {
			max = total;
		}
	}
	return max;
}

/**
 * Evaluates a scalar track at the given elapsed time and sends the command if the value changed.
 *
 * Interpolates the keyframe value, maps it to the feature's output range,
 * and deduplicates to avoid sending redundant commands.
 *
 * @param state - Mutable pattern state for deduplication tracking
 * @param track - The resolved scalar track to evaluate
 * @param elapsed - Milliseconds elapsed in the current cycle
 * @param device - Target device for output commands
 * @param buildCommand - Factory for creating output commands from track and value
 * @param onError - Error handler invoked on command failures
 */
export function evaluateScalarTrack(
	state: PatternState,
	track: ResolvedTrack,
	elapsed: number,
	device: PatternDevice,
	buildCommand: (track: ResolvedTrack, value: number) => OutputCommand,
	onError: (state: PatternState, err: unknown) => void
): void {
	const { keyframes, featureIndex, range } = track;
	const value = interpolateKeyframes(keyframes, elapsed);
	const mapped = Math.round(range[0] + value * (range[1] - range[0]));

	if (state.lastSentValues.get(featureIndex) === mapped) {
		return;
	}

	const command = buildCommand(track, mapped);
	device.output({ featureIndex, command }).catch((err) => {
		state.lastSentValues.delete(featureIndex);
		onError(state, err);
	});
	state.lastSentValues.set(featureIndex, mapped);
}

/**
 * Evaluates a HwPositionWithDuration track and sends a position command when the active keyframe changes.
 *
 * Unlike scalar tracks, position tracks send the target value and duration together,
 * allowing the device firmware to handle interpolation. Commands are only sent
 * when the active keyframe index changes.
 *
 * @param state - Mutable pattern state for keyframe index deduplication
 * @param track - The resolved position track to evaluate
 * @param elapsed - Milliseconds elapsed in the current cycle
 * @param device - Target device for output commands
 * @param onError - Error handler invoked on command failures
 */
export function evaluateHwPositionTrack(
	state: PatternState,
	track: ResolvedTrack,
	elapsed: number,
	device: PatternDevice,
	onError: (state: PatternState, err: unknown) => void
): void {
	const { keyframes, featureIndex, range, durationRange } = track;

	let accumulated = 0;
	let activeIndex = 0;

	// Handle zero-duration keyframes as instant position commands before finding the interpolated keyframe.
	for (const [i, kf] of keyframes.entries()) {
		if (kf.duration === 0 && elapsed >= accumulated) {
			// Instant position: send immediately if not already sent
			if (state.lastSentKeyframeIndex.get(featureIndex) !== i) {
				const mappedValue = Math.round(range[0] + kf.value * (range[1] - range[0]));
				const command: OutputCommand = {
					HwPositionWithDuration: { Position: mappedValue, Duration: 0 },
				};
				device.output({ featureIndex, command }).catch((err) => onError(state, err));
				state.lastSentKeyframeIndex.set(featureIndex, i);
			}
			activeIndex = i;
			continue;
		}

		if (elapsed < accumulated + kf.duration) {
			activeIndex = i;
			break;
		}
		accumulated += kf.duration;
		activeIndex = i;
	}

	const kf = keyframes[activeIndex];
	if (!kf || kf.duration === 0) {
		return;
	}

	if (state.lastSentKeyframeIndex.get(featureIndex) === activeIndex) {
		return;
	}

	const mappedValue = Math.round(range[0] + kf.value * (range[1] - range[0]));
	let duration = kf.duration;
	if (durationRange) {
		duration = Math.max(durationRange[0], Math.min(durationRange[1], duration));
	}

	const command: OutputCommand = {
		HwPositionWithDuration: { Position: mappedValue, Duration: duration },
	};

	device.output({ featureIndex, command }).catch((err) => onError(state, err));
	state.lastSentKeyframeIndex.set(featureIndex, activeIndex);
}

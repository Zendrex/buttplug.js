import { DeviceError } from "../../lib/errors";
import { mapToRange } from "../../lib/range";
import { EASING_FUNCTIONS } from "../easing";
import type { OutputCommand } from "../../protocol/schema";
import type { PatternDevice } from "../types";
import type { ResolvedKeyframe, ResolvedTrack } from "./resolver";
import type { PatternState } from "./state";

function interpolateKeyframes(keyframes: ResolvedKeyframe[], elapsed: number): number {
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
			const result = prevValue + (kf.value - prevValue) * EASING_FUNCTIONS[kf.easing](t);
			return Math.max(0, Math.min(1, result));
		}

		accumulated += kf.duration;
		value = kf.value;
	}

	return Math.max(0, Math.min(1, value));
}

export function buildScalarCommand(track: ResolvedTrack, value: number, deviceIndex: number): OutputCommand {
	if (track.outputType === "RotateWithDirection") {
		return { RotateWithDirection: { Value: value, Clockwise: track.clockwise } };
	}
	if (track.outputType === "HwPositionWithDuration") {
		throw new DeviceError(deviceIndex, `Unsupported output type in pattern: ${track.outputType}`);
	}
	return { [track.outputType]: { Value: value } } as OutputCommand;
}

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

export function evaluateScalarTrack(
	state: PatternState,
	track: ResolvedTrack,
	elapsed: number,
	device: PatternDevice,
	onError: (err: unknown) => void
): void {
	const { keyframes, featureIndex, range } = track;
	const value = interpolateKeyframes(keyframes, elapsed);
	const mapped = mapToRange(value, range);

	if (state.lastSentValues.get(featureIndex) === mapped) {
		return;
	}

	const command = buildScalarCommand(track, mapped, state.deviceIndex);
	device.output({ featureIndex, command }).catch((err) => {
		state.lastSentValues.delete(featureIndex);
		onError(err);
	});
	state.lastSentValues.set(featureIndex, mapped);
}

export function evaluateHwPositionTrack(
	state: PatternState,
	track: ResolvedTrack,
	elapsed: number,
	device: PatternDevice,
	onError: (err: unknown) => void
): void {
	const { keyframes, featureIndex, range, durationRange } = track;

	let accumulated = 0;
	let activeIndex = 0;

	for (const [i, kf] of keyframes.entries()) {
		if (kf.duration === 0 && elapsed >= accumulated) {
			if (state.lastSentKeyframeIndex.get(featureIndex) !== i) {
				const mappedValue = mapToRange(kf.value, range);
				const command: OutputCommand = {
					HwPositionWithDuration: { Position: mappedValue, Duration: 0 },
				};
				device.output({ featureIndex, command }).catch((err) => onError(err));
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

	const mappedValue = mapToRange(kf.value, range);
	let duration = kf.duration;
	if (durationRange) {
		duration = Math.max(durationRange[0], Math.min(durationRange[1], duration));
	}

	const command: OutputCommand = {
		HwPositionWithDuration: { Position: mappedValue, Duration: duration },
	};

	device.output({ featureIndex, command }).catch((err) => onError(err));
	state.lastSentKeyframeIndex.set(featureIndex, activeIndex);
}

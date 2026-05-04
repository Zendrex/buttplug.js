import { DeviceError } from "../../lib/errors";
import { getOutputsByType } from "../../protocol/features";
import { PRESETS } from "../presets";
import type { OutputFeature, OutputType } from "../../protocol/schema";
import type { Easing } from "../easing";
import type { PresetPattern } from "../presets";
import type { CustomPattern } from "../track";
import type { PatternDevice } from "../types";

export interface ResolvedKeyframe {
	readonly duration: number;
	readonly easing: Easing;
	readonly value: number;
}

export interface ResolvedTrack {
	readonly clockwise: boolean;
	readonly durationRange: [number, number] | undefined;
	readonly featureIndex: number;
	readonly keyframes: ResolvedKeyframe[];
	readonly outputType: OutputType;
	readonly range: [number, number];
}

export function resolveTracks(
	device: PatternDevice,
	descriptor: PresetPattern | CustomPattern,
	featureIndex?: number
): ResolvedTrack[] {
	if (descriptor.type === "preset") {
		return resolvePresetTracks(device, descriptor, featureIndex);
	}
	return resolveCustomTracks(device, descriptor);
}

export function resolvePresetTracks(
	device: PatternDevice,
	descriptor: PresetPattern,
	featureIndex?: number
): ResolvedTrack[] {
	const preset = PRESETS[descriptor.preset];
	if (!preset) {
		throw new DeviceError(device.index, `Unknown preset: ${descriptor.preset}`);
	}

	const intensity = descriptor.intensity ?? 1;
	const speed = descriptor.speed ?? 1;

	const matchingFeatures: { feature: OutputFeature; outputType: OutputType }[] = [];
	for (const outputType of preset.outputTypes) {
		const features = getOutputsByType(device.features, outputType);
		for (const feature of features) {
			if (featureIndex === undefined || feature.index === featureIndex) {
				matchingFeatures.push({ feature, outputType });
			}
		}
	}

	if (featureIndex !== undefined && matchingFeatures.length === 0) {
		throw new DeviceError(
			device.index,
			`Feature at index ${featureIndex} is not compatible with preset "${descriptor.preset}"`
		);
	}

	const tracks: ResolvedTrack[] = [];
	for (const [i, match] of matchingFeatures.entries()) {
		const presetTrack = preset.tracks[i % preset.tracks.length];
		if (!presetTrack) {
			continue;
		}

		const keyframes: ResolvedKeyframe[] = presetTrack.map((kf) => ({
			value: kf.value * intensity,
			duration: speed > 0 ? kf.duration / speed : kf.duration,
			easing: kf.easing ?? "linear",
		}));

		tracks.push({
			featureIndex: match.feature.index,
			outputType: match.outputType,
			keyframes,
			range: match.feature.range,
			durationRange: match.feature.durationRange,
			clockwise: true,
		});
	}

	return tracks;
}

export function resolveCustomTracks(device: PatternDevice, descriptor: CustomPattern): ResolvedTrack[] {
	const intensity = descriptor.intensity ?? 1;
	const tracks: ResolvedTrack[] = [];

	for (const track of descriptor.tracks) {
		const feature = track.outputType
			? device.features.outputs.find(
					(f: OutputFeature) => f.index === track.featureIndex && f.type === track.outputType
				)
			: device.features.outputs.find((f: OutputFeature) => f.index === track.featureIndex);
		if (!feature) {
			throw new DeviceError(
				device.index,
				`No output feature at index ${track.featureIndex}${track.outputType ? ` with type "${track.outputType}"` : ""}`
			);
		}

		const keyframes: ResolvedKeyframe[] = track.keyframes.map((kf) => ({
			value: kf.value * intensity,
			duration: kf.duration,
			easing: kf.easing ?? "linear",
		}));

		tracks.push({
			featureIndex: feature.index,
			outputType: feature.type,
			keyframes,
			range: feature.range,
			durationRange: feature.durationRange,
			clockwise: track.clockwise ?? true,
		});
	}

	return tracks;
}

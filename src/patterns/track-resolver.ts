import type { OutputFeature, OutputType } from "../protocol/schema";
import type {
	CustomPattern,
	PatternDescriptor,
	PatternDevice,
	PresetPattern,
	ResolvedKeyframe,
	ResolvedTrack,
} from "./types";

import { getOutputsByType } from "../builders/features";
import { DeviceError } from "../lib/errors";
import { PRESETS } from "./presets";

/**
 * Resolves a pattern descriptor into concrete {@link ResolvedTrack} arrays bound to device features.
 *
 * Delegates to preset or custom resolution based on the descriptor type.
 *
 * @param device - Target device providing feature information
 * @param descriptor - Pattern descriptor to resolve
 * @param featureIndex - Optional specific feature to target (preset patterns only)
 * @returns Array of resolved tracks ready for scheduling
 */
export function resolveTracks(
	device: PatternDevice,
	descriptor: PatternDescriptor,
	featureIndex?: number
): ResolvedTrack[] {
	if (descriptor.type === "preset") {
		return resolvePresetTracks(device, descriptor, featureIndex);
	}
	return resolveCustomTracks(device, descriptor);
}

/**
 * Resolves a preset pattern into tracks by matching compatible device features.
 *
 * Finds all device features matching the preset's output types, applies intensity
 * and speed scaling to keyframes, and assigns preset tracks via round-robin
 * when there are more features than preset tracks.
 *
 * @param device - Target device providing feature information
 * @param descriptor - Preset pattern descriptor with preset name, intensity, and speed
 * @param featureIndex - Optional specific feature index to target
 * @returns Array of resolved tracks for matching features
 * @throws {DeviceError} If the preset is unknown or the specified feature is incompatible
 */
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

/**
 * Resolves custom pattern tracks by binding each track to its specified device feature.
 *
 * Validates that each track's feature index (and optional output type) exists on the device,
 * then applies intensity scaling to keyframe values.
 *
 * @param device - Target device providing feature information
 * @param descriptor - Custom pattern descriptor with explicit track definitions
 * @returns Array of resolved tracks bound to device features
 * @throws {DeviceError} If a specified feature index or output type is not found on the device
 */
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

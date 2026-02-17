import type {
	PatternDescriptor,
	PatternDevice,
	PatternEngineClient,
	PatternInfo,
	PatternPlayOptions,
	PatternState,
	PresetInfo,
	PresetName,
	StopReason,
	Track,
} from "./types";

import { DeviceError, ProtocolError } from "../lib/errors";
import { getPresetInfo, PRESETS } from "./presets";
import { buildScalarCommand, evaluateHwPositionTrack, evaluateScalarTrack, getCycleDuration } from "./scheduler";
import { resolveTracks } from "./track-resolver";
import { PatternDescriptorSchema } from "./types";

/** Default safety timeout: 30 minutes. */
const DEFAULT_TIMEOUT_MS = 1_800_000;

/** Minimum tick interval to prevent overwhelming slow devices. */
const MIN_TICK_INTERVAL_MS = 50;

// biome-ignore lint/suspicious/noEmptyBlockStatements: fire-and-forget error swallowing for stop commands
const noop = () => {};

/**
 * Orchestrates pattern playback on buttplug devices using tick-based keyframe scheduling.
 *
 * Manages the lifecycle of active patterns including loop handling, drift-corrected
 * tick scheduling, deduplication of redundant commands, and automatic cleanup on
 * disconnect or device removal.
 */
export class PatternEngine {
	/** Client interface for device access and event subscription. */
	readonly #client: PatternEngineClient;
	/** Active pattern states keyed by pattern ID. */
	readonly #patterns: Map<string, PatternState> = new Map();
	/** Default safety timeout in milliseconds. */
	readonly #defaultTimeout: number;
	/** Unsubscribe function for the client disconnect event. */
	readonly #unsubDisconnect: () => void;
	/** Unsubscribe function for the device removed event. */
	readonly #unsubDeviceRemoved: () => void;
	/** Whether this engine has been disposed. */
	#disposed = false;

	/**
	 * @param client - Client providing device access and event hooks
	 * @param options - Optional configuration for default timeout behavior
	 */
	constructor(client: PatternEngineClient, options?: { defaultTimeout?: number }) {
		this.#client = client;
		this.#defaultTimeout = options?.defaultTimeout ?? DEFAULT_TIMEOUT_MS;

		this.#unsubDisconnect = client.on("disconnected", () => {
			this.#stopMatchingPatterns("disconnect");
		});
		this.#unsubDeviceRemoved = client.on("deviceRemoved", ({ device }) => {
			this.#stopMatchingPatterns("deviceRemoved", device.index);
		});
	}

	/**
	 * Starts playing a preset pattern on a device by name.
	 *
	 * @param device - Target device or device index
	 * @param preset - Built-in preset name (e.g. "wave", "pulse")
	 * @param options - Playback options including intensity, speed, loop, timeout, and callbacks
	 * @returns Unique pattern instance ID for later control
	 * @throws {DeviceError} If the engine is disposed, device not found, or no compatible features
	 */
	// biome-ignore lint/style/useUnifiedTypeSignatures: separate overloads provide distinct IntelliSense per pattern form
	play(device: PatternDevice | number, preset: PresetName, options?: PatternPlayOptions): Promise<string>;
	/**
	 * Starts playing a custom pattern defined by keyframe tracks.
	 *
	 * @param device - Target device or device index
	 * @param tracks - Array of {@link Track} definitions with keyframes bound to feature indices
	 * @param options - Playback options including intensity, loop, timeout, and callbacks
	 * @returns Unique pattern instance ID for later control
	 * @throws {DeviceError} If the engine is disposed, device not found, or no compatible features
	 */
	play(device: PatternDevice | number, tracks: Track[], options?: PatternPlayOptions): Promise<string>;
	/**
	 * Starts playing a pattern from a full {@link PatternDescriptor}.
	 *
	 * @param device - Target device or device index
	 * @param descriptor - Full pattern descriptor (preset or custom)
	 * @param options - Playback options including timeout and callbacks
	 * @returns Unique pattern instance ID for later control
	 * @throws {DeviceError} If the engine is disposed, device not found, or no compatible features
	 */
	play(device: PatternDevice | number, descriptor: PatternDescriptor, options?: PatternPlayOptions): Promise<string>;
	// biome-ignore lint/suspicious/useAwait: async API contract per spec — errors become rejected promises
	async play(
		device: PatternDevice | number,
		pattern: PresetName | Track[] | PatternDescriptor,
		options?: PatternPlayOptions
	): Promise<string> {
		const deviceIndex = typeof device === "number" ? device : device.index;

		if (this.#disposed) {
			throw new DeviceError(deviceIndex, "PatternEngine has been disposed");
		}

		// Build descriptor from shorthand forms
		const descriptor = this.#buildDescriptor(pattern, options);
		const parsed = PatternDescriptorSchema.parse(descriptor);

		const resolvedDevice = typeof device === "number" ? this.#client.getDevice(device) : device;
		if (!resolvedDevice) {
			throw new DeviceError(deviceIndex, `Device at index ${deviceIndex} not found`);
		}

		const tracks = resolveTracks(resolvedDevice, parsed, options?.featureIndex);
		if (tracks.length === 0) {
			throw new DeviceError(deviceIndex, "No compatible features found on device");
		}

		// Auto-stop all existing patterns on the same device
		for (const s of this.#patterns.values()) {
			if (s.deviceIndex === deviceIndex) {
				this.#stopPatternInternal(s, "manual");
			}
		}

		// Resolve loop behavior
		const loop =
			parsed.type === "preset" ? (parsed.loop ?? PRESETS[parsed.preset]?.loop ?? false) : (parsed.loop ?? false);
		let remainingLoops: number;
		if (loop === true) {
			remainingLoops = Number.POSITIVE_INFINITY;
		} else if (typeof loop === "number") {
			remainingLoops = loop;
		} else {
			remainingLoops = 1;
		}

		const id = crypto.randomUUID();
		const tickInterval = Math.max(resolvedDevice.messageTimingGap, MIN_TICK_INTERVAL_MS);
		const now = performance.now();
		const state: PatternState = {
			id,
			deviceIndex,
			descriptor: parsed,
			tracks,
			loop,
			remainingLoops,
			startedAt: now,
			stopped: false,
			timerId: null,
			safetyTimerId: null,
			tickInterval,
			expectedTickTime: now,
			lastSentValues: new Map(),
			lastSentKeyframeIndex: new Map(),
			options: options ?? {},
		};

		this.#patterns.set(id, state);

		const timeout = options?.timeout ?? this.#defaultTimeout;
		if (timeout > 0) {
			state.safetyTimerId = setTimeout(() => this.#stopPatternInternal(state, "timeout"), timeout);
		}
		state.timerId = setTimeout(() => this.#tick(state, resolvedDevice), 0);
		return id;
	}

	/**
	 * Stops a specific pattern by its ID.
	 *
	 * No-op if the pattern ID is not found (already stopped or never started).
	 *
	 * @param patternId - The pattern instance ID returned by {@link play}
	 */
	// biome-ignore lint/suspicious/useAwait: async API contract per spec
	async stop(patternId: string): Promise<void> {
		const state = this.#patterns.get(patternId);
		if (!state) {
			return;
		}
		this.#stopPatternInternal(state, "manual");
	}

	/**
	 * Stops all active patterns.
	 *
	 * @returns Number of patterns that were stopped
	 */
	stopAll(): number {
		return this.#stopMatchingPatterns("manual");
	}

	/**
	 * Stops all active patterns targeting a specific device.
	 *
	 * @param deviceIndex - The device index to stop patterns for
	 * @returns Number of patterns that were stopped
	 */
	stopByDevice(deviceIndex: number): number {
		return this.#stopMatchingPatterns("manual", deviceIndex);
	}

	/**
	 * Returns a snapshot of all active patterns.
	 *
	 * @returns Array of {@link PatternInfo} snapshots
	 */
	list(): PatternInfo[] {
		const now = performance.now();
		return [...this.#patterns.values()].map((state) => ({
			id: state.id,
			deviceIndex: state.deviceIndex,
			featureIndices: state.tracks.map((t) => t.featureIndex),
			descriptor: state.descriptor,
			startedAt: state.startedAt,
			elapsed: now - state.startedAt,
		}));
	}

	/**
	 * Returns metadata for all available built-in presets.
	 *
	 * @returns Array of {@link PresetInfo} descriptors
	 */
	listPresets(): PresetInfo[] {
		return getPresetInfo();
	}

	/**
	 * Disposes the engine, stopping all patterns and unsubscribing from client events.
	 *
	 * Subsequent calls to {@link play} will throw. Idempotent.
	 */
	dispose(): void {
		if (this.#disposed) {
			return;
		}
		this.#disposed = true;
		this.#unsubDisconnect();
		this.#unsubDeviceRemoved();
		this.#stopMatchingPatterns("manual");
	}

	/** Evaluates all tracks at the current time and schedules the next tick. */
	#tick(state: PatternState, device: PatternDevice): void {
		if (state.stopped) {
			return;
		}

		const elapsed = performance.now() - state.startedAt;
		const cycleDuration = getCycleDuration(state.tracks);

		// Evaluate all tracks before checking cycle completion so the final
		// tick's keyframe values are sent before stopping.
		const cycleElapsed = cycleDuration > 0 && elapsed >= cycleDuration ? cycleDuration : elapsed;
		const onError = (s: PatternState, err: unknown) => this.#handleOutputError(s, err);

		for (const track of state.tracks) {
			if (track.outputType === "HwPositionWithDuration") {
				evaluateHwPositionTrack(state, track, cycleElapsed, device, onError);
			} else {
				evaluateScalarTrack(state, track, cycleElapsed, device, buildScalarCommand, onError);
			}
		}

		// Check cycle completion after track evaluation
		if (cycleDuration > 0 && elapsed >= cycleDuration) {
			if (state.remainingLoops === Number.POSITIVE_INFINITY) {
				state.startedAt += cycleDuration;
				state.lastSentKeyframeIndex.clear();
			} else if (state.remainingLoops > 1) {
				state.remainingLoops--;
				state.startedAt += cycleDuration;
				state.lastSentKeyframeIndex.clear();
			} else {
				this.#stopPatternInternal(state, "complete", true);
				return;
			}
		}

		// Schedule next tick with drift correction
		const drift = performance.now() - state.expectedTickTime;
		const nextDelay = Math.max(0, state.tickInterval - drift);
		state.expectedTickTime = performance.now() + nextDelay;
		state.timerId = setTimeout(() => this.#tick(state, device), nextDelay);
	}

	/** Builds a {@link PatternDescriptor} from the shorthand pattern argument and options. */
	#buildDescriptor(
		pattern: PresetName | Track[] | PatternDescriptor,
		options?: PatternPlayOptions
	): PatternDescriptor {
		if (typeof pattern === "string") {
			return {
				type: "preset",
				preset: pattern,
				intensity: options?.intensity,
				speed: options?.speed,
				loop: options?.loop,
			};
		}
		if (Array.isArray(pattern)) {
			return {
				type: "custom",
				tracks: pattern,
				intensity: options?.intensity,
				loop: options?.loop,
			};
		}
		return pattern;
	}

	/** Stops the pattern on device or protocol errors; ignores transient failures. */
	#handleOutputError(state: PatternState, err: unknown): void {
		if (err instanceof DeviceError || err instanceof ProtocolError) {
			this.#stopPatternInternal(state, "error");
		}
	}

	/** Stops all patterns, optionally filtered by device index. */
	#stopMatchingPatterns(reason: StopReason, deviceIndex?: number): number {
		const patterns =
			deviceIndex !== undefined
				? [...this.#patterns.values()].filter((s) => s.deviceIndex === deviceIndex)
				: [...this.#patterns.values()];
		for (const state of patterns) {
			this.#stopPatternInternal(state, reason);
		}
		return patterns.length;
	}

	/** Stops a pattern, clears its timers, sends zero-value stop commands, and fires callbacks. */
	#stopPatternInternal(state: PatternState, reason: StopReason, complete = false): void {
		if (state.stopped) {
			return;
		}
		state.stopped = true;

		if (state.timerId !== null) {
			clearTimeout(state.timerId);
			state.timerId = null;
		}
		if (state.safetyTimerId !== null) {
			clearTimeout(state.safetyTimerId);
			state.safetyTimerId = null;
		}

		this.#patterns.delete(state.id);

		// Send zero-value stop commands (fire-and-forget, bypass dedup)
		const device = this.#client.getDevice(state.deviceIndex);
		if (device) {
			for (const track of state.tracks) {
				if (track.outputType === "Position" || track.outputType === "HwPositionWithDuration") {
					device.stop({ featureIndex: track.featureIndex }).catch(noop);
				} else {
					const command = buildScalarCommand(track, track.range[0]);
					device.output({ featureIndex: track.featureIndex, command }).catch(noop);
				}
			}
		}

		if (complete) {
			state.options.onComplete?.(state.id);
		}
		state.options.onStop?.(state.id, reason);
	}
}

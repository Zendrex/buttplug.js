import { DeviceError, ProtocolError } from "../lib/errors";
import { PatternDescriptorSchema } from "./descriptor";
import { resolveTracks } from "./internal/resolver";
import { evaluateHwPositionTrack, evaluateScalarTrack, getCycleDuration } from "./internal/scheduler";
import { getPresetInfo, PRESETS } from "./presets";
import type { PatternDescriptor } from "./descriptor";
import type { PatternState } from "./internal/state";
import type { PresetInfo, PresetName } from "./presets";
import type { Track } from "./track";
import type { PatternDevice, PatternEngineClient, PatternInfo, PatternPlayOptions, StopReason } from "./types";

export class PatternEngine {
	static readonly DEFAULT_TIMEOUT_MS = 1_800_000;
	static readonly DEFAULT_TICK_INTERVAL_MS = 50;
	private readonly client: PatternEngineClient;
	private readonly patterns: Map<string, PatternState> = new Map();
	private readonly defaultTimeout: number;
	private readonly unsubDisconnect: () => void;
	private readonly unsubDeviceRemoved: () => void;
	private disposed = false;

	constructor(client: PatternEngineClient, options?: { defaultTimeout?: number }) {
		this.client = client;
		this.defaultTimeout = options?.defaultTimeout ?? PatternEngine.DEFAULT_TIMEOUT_MS;

		this.unsubDisconnect = client.on("connection.disconnected", () => {
			this.stopMatchingPatterns("disconnect");
		});
		this.unsubDeviceRemoved = client.on("device.removed", ({ data: { device } }) => {
			this.stopMatchingPatterns("deviceRemoved", device.index);
		});
	}

	play(device: PatternDevice | number, preset: PresetName, options?: PatternPlayOptions): Promise<string>;
	play(device: PatternDevice | number, tracks: Track[], options?: PatternPlayOptions): Promise<string>;
	play(device: PatternDevice | number, descriptor: PatternDescriptor, options?: PatternPlayOptions): Promise<string>;
	play(
		device: PatternDevice | number,
		pattern: PresetName | Track[] | PatternDescriptor,
		options?: PatternPlayOptions
	): Promise<string> {
		const deviceIndex = typeof device === "number" ? device : device.index;

		if (this.disposed) {
			throw new DeviceError(deviceIndex, "PatternEngine has been disposed");
		}

		const descriptor = this.buildDescriptor(pattern, options);
		const parsed = PatternDescriptorSchema.parse(descriptor);

		const resolvedDevice = typeof device === "number" ? this.client.getDevice(device) : device;
		if (!resolvedDevice) {
			throw new DeviceError(deviceIndex, `Device at index ${deviceIndex} not found`);
		}

		const tracks = resolveTracks(resolvedDevice, parsed, options?.featureIndex);
		if (tracks.length === 0) {
			throw new DeviceError(deviceIndex, "No compatible features found on device");
		}

		for (const state of this.patterns.values()) {
			if (state.deviceIndex === deviceIndex) {
				this.stopPatternInternal(state, "manual");
			}
		}

		const presetDefaultLoop = parsed.type === "preset" ? PRESETS[parsed.preset].loop : false;
		const loop = parsed.loop ?? presetDefaultLoop;
		let remainingLoops: number;
		if (loop === true) {
			remainingLoops = Number.POSITIVE_INFINITY;
		} else if (typeof loop === "number") {
			remainingLoops = loop;
		} else {
			remainingLoops = 1;
		}

		const id = crypto.randomUUID();
		const tickInterval = options?.tickInterval ?? PatternEngine.DEFAULT_TICK_INTERVAL_MS;
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

		this.patterns.set(id, state);

		const timeout = options?.timeout ?? this.defaultTimeout;
		if (timeout > 0) {
			state.safetyTimerId = setTimeout(() => this.stopPatternInternal(state, "timeout"), timeout);
		}
		state.timerId = setTimeout(() => this.tick(state, resolvedDevice), 0);
		return Promise.resolve(id);
	}

	stop(patternId: string): Promise<void> {
		const state = this.patterns.get(patternId);
		if (!state) {
			return Promise.resolve();
		}
		this.stopPatternInternal(state, "manual");
		return Promise.resolve();
	}

	stopAll(): number {
		return this.stopMatchingPatterns("manual");
	}

	stopByDevice(deviceIndex: number): number {
		return this.stopMatchingPatterns("manual", deviceIndex);
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.unsubDisconnect();
		this.unsubDeviceRemoved();
		this.stopMatchingPatterns("manual");
	}

	list(): PatternInfo[] {
		const now = performance.now();
		return [...this.patterns.values()].map((state) => ({
			id: state.id,
			deviceIndex: state.deviceIndex,
			featureIndices: state.tracks.map((t) => t.featureIndex),
			descriptor: state.descriptor,
			startedAt: state.startedAt,
			elapsed: now - state.startedAt,
		}));
	}

	listPresets(): PresetInfo[] {
		return getPresetInfo();
	}

	private tick(state: PatternState, device: PatternDevice): void {
		if (state.stopped) {
			return;
		}

		const now = performance.now();
		const elapsed = now - state.startedAt;
		const cycleDuration = getCycleDuration(state.tracks);

		const cycleComplete = cycleDuration > 0 && elapsed >= cycleDuration;
		const cycleElapsed = cycleComplete ? cycleDuration : elapsed;
		const onError = (err: unknown) => this.handleOutputError(state, err);

		for (const track of state.tracks) {
			if (track.outputType === "HwPositionWithDuration") {
				evaluateHwPositionTrack(state, track, cycleElapsed, device, onError);
			} else {
				evaluateScalarTrack(state, track, cycleElapsed, device, onError);
			}
		}

		if (cycleComplete) {
			if (state.remainingLoops === Number.POSITIVE_INFINITY) {
				state.startedAt += cycleDuration;
				state.lastSentKeyframeIndex.clear();
			} else if (state.remainingLoops > 1) {
				state.remainingLoops--;
				state.startedAt += cycleDuration;
				state.lastSentKeyframeIndex.clear();
			} else {
				this.stopPatternInternal(state, "complete", true);
				return;
			}
		}

		const drift = now - state.expectedTickTime;
		const nextDelay = Math.max(0, state.tickInterval - drift);
		state.expectedTickTime = now + nextDelay;
		state.timerId = setTimeout(() => this.tick(state, device), nextDelay);
	}

	private handleOutputError(state: PatternState, err: unknown): void {
		if (err instanceof DeviceError || err instanceof ProtocolError) {
			this.stopPatternInternal(state, "error");
		}
	}

	private buildDescriptor(
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

	private stopMatchingPatterns(reason: StopReason, deviceIndex?: number): number {
		const patterns =
			deviceIndex === undefined
				? [...this.patterns.values()]
				: [...this.patterns.values()].filter((s) => s.deviceIndex === deviceIndex);
		for (const state of patterns) {
			this.stopPatternInternal(state, reason);
		}
		return patterns.length;
	}

	private stopPatternInternal(state: PatternState, reason: StopReason, complete = false): void {
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

		this.patterns.delete(state.id);

		const device = this.client.getDevice(state.deviceIndex);
		if (device) {
			for (const track of state.tracks) {
				device.stop({ featureIndex: track.featureIndex }).catch(() => undefined);
			}
		}

		if (complete) {
			state.options.onComplete?.(state.id);
		}
		state.options.onStop?.(state.id, reason);
	}
}

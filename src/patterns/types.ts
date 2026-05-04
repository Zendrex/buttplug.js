import type { DeviceOutputOptions, DeviceStopOptions } from "../device";
import type { DeviceFeatures } from "../protocol/schema";
import type { PatternDescriptor } from "./engine";
import type { ResolvedTrack } from "./track-resolver";

export interface PatternDevice {
	readonly features: DeviceFeatures;
	readonly index: number;
	readonly name: string;
	output(options: DeviceOutputOptions): Promise<void>;
	stop(options?: DeviceStopOptions): Promise<void>;
}

export type StopReason = "manual" | "complete" | "timeout" | "error" | "disconnect" | "deviceRemoved";

export interface PatternEngineClient {
	getDevice(index: number): PatternDevice | undefined;
	on(
		event: "disconnected",
		handler: (event: { name: "disconnected"; data: { reason?: string } }) => void
	): () => void;
	on(
		event: "deviceRemoved",
		handler: (event: { name: "deviceRemoved"; data: { device: PatternDevice } }) => void
	): () => void;
}

export interface PatternPlayOptions {
	featureIndex?: number;
	intensity?: number;
	loop?: boolean | number;
	onComplete?: (patternId: string) => void;
	onStop?: (patternId: string, reason: StopReason) => void;
	speed?: number;
	tickInterval?: number;
	timeout?: number;
}

export interface PatternInfo {
	readonly descriptor: PatternDescriptor;
	readonly deviceIndex: number;
	readonly elapsed: number;
	readonly featureIndices: number[];
	readonly id: string;
	readonly startedAt: number;
}

export interface PatternState {
	readonly descriptor: PatternDescriptor;
	readonly deviceIndex: number;
	expectedTickTime: number;
	readonly id: string;
	readonly lastSentKeyframeIndex: Map<number, number>;
	readonly lastSentValues: Map<number, number>;
	readonly loop: boolean | number;
	readonly options: PatternPlayOptions;
	remainingLoops: number;
	safetyTimerId: ReturnType<typeof setTimeout> | null;
	startedAt: number;
	stopped: boolean;
	readonly tickInterval: number;
	timerId: ReturnType<typeof setTimeout> | null;
	readonly tracks: ResolvedTrack[];
}

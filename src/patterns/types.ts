import type { DeviceOutputOptions, DeviceStopOptions } from "../device";
import type { DeviceFeatures } from "../protocol/schema";
import type { PatternDescriptor } from "./track";

export interface PatternDevice {
	readonly features: DeviceFeatures;
	readonly index: number;
	readonly name: string;
	output(options: DeviceOutputOptions): Promise<void>;
	stop(options?: DeviceStopOptions): Promise<void>;
}

export type StopReason = "manual" | "complete" | "timeout" | "error" | "disconnect" | "deviceRemoved";

export interface PatternClient {
	getDevice(index: number): PatternDevice | undefined;
	on(
		event: "connection.disconnected",
		handler: (event: { name: "connection.disconnected"; data: { reason?: string } }) => void
	): () => void;
	on(
		event: "device.removed",
		handler: (event: { name: "device.removed"; data: { device: PatternDevice } }) => void
	): () => void;
}

export interface PatternPlayOptions {
	featureIndex?: number;
	intensity?: number;
	loop?: boolean | number;
	onComplete?: (id: string) => void;
	onStop?: (id: string, reason: StopReason) => void;
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

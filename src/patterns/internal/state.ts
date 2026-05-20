import type { PatternDescriptor } from "../descriptor";
import type { PatternPlayOptions } from "../types";
import type { ResolvedTrack } from "./resolver";

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

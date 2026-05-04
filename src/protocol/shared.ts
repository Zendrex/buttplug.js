import type { InputType } from "./schema";

export function sensorKey(deviceIndex: number, featureIndex: number, type: InputType): string {
	return `${deviceIndex}-${featureIndex}-${type}`;
}

import type { ClientMessage, InputType, ServerMessage } from "./schema";

export type SensorCallback = (value: number) => void;

export interface DeviceMessageSender {
	nextId(): number;
	registerSensorSubscription(
		key: string,
		callback: SensorCallback,
		info: { deviceIndex: number; featureIndex: number; type: InputType }
	): void;
	send(messages: ClientMessage | ClientMessage[]): Promise<ServerMessage[]>;
	unregisterSensorSubscription(key: string): void;
}

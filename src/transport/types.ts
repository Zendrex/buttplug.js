export interface TransportEvents {
	close: (code: number, reason: string) => void;
	error: (error: Error) => void;
	message: (data: string) => void;
	open: () => void;
}

export type TransportState = "disconnected" | "connecting" | "connected";

export type TransportEventName = keyof TransportEvents;

export interface Transport {
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	off<E extends TransportEventName>(event: E, handler: TransportEvents[E]): void;
	on<E extends TransportEventName>(event: E, handler: TransportEvents[E]): void;
	send(data: string): void;
	readonly state: TransportState;
}

export const ErrorCode = {
	UNKNOWN: 0,
	INIT: 1,
	PING: 2,
	MESSAGE: 3,
	DEVICE: 4,
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class ButtplugError extends Error {
	override readonly name: string = "ButtplugError";

	constructor(message: string, cause?: Error) {
		super(message, { cause });
	}
}

export class ConnectionError extends ButtplugError {
	override readonly name: string = "ConnectionError";
}

export class HandshakeError extends ButtplugError {
	override readonly name: string = "HandshakeError";
}

export class ProtocolError extends ButtplugError {
	override readonly name: string = "ProtocolError";

	readonly code: ErrorCode;

	constructor(code: ErrorCode, message: string, cause?: Error) {
		super(message, cause);
		this.code = code;
	}
}

export class DeviceError extends ButtplugError {
	override readonly name: string = "DeviceError";

	readonly deviceIndex: number;

	constructor(deviceIndex: number, message: string, cause?: Error) {
		super(message, cause);
		this.deviceIndex = deviceIndex;
	}
}

export class TimeoutError extends ButtplugError {
	override readonly name: string = "TimeoutError";

	readonly operation: string;

	readonly timeoutMs: number;

	constructor(operation: string, timeoutMs: number, cause?: Error) {
		super(`${operation} timed out after ${timeoutMs}ms`, cause);
		this.operation = operation;
		this.timeoutMs = timeoutMs;
	}
}

export function formatError(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

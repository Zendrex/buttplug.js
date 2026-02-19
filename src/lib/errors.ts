/** Numeric error codes returned by the Buttplug protocol. */
export const ErrorCode = {
	UNKNOWN: 0,
	INIT: 1,
	PING: 2,
	MESSAGE: 3,
	DEVICE: 4,
} as const;

/** Union type of all valid Buttplug error codes. */
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Base error class for all Buttplug-related failures. */
export class ButtplugError extends Error {
	override readonly name: string = "ButtplugError";

	/**
	 * @param message - Human-readable error description
	 * @param cause - The underlying error that caused this failure
	 */
	constructor(message: string, cause?: Error) {
		super(message, { cause });
	}
}

/** Error thrown when a WebSocket or transport connection fails. */
export class ConnectionError extends ButtplugError {
	override readonly name: string = "ConnectionError";
}

/** Error thrown when the initial protocol handshake with the server fails. */
export class HandshakeError extends ButtplugError {
	override readonly name: string = "HandshakeError";
}

/** Error thrown when the server returns a protocol-level error message. */
export class ProtocolError extends ButtplugError {
	override readonly name: string = "ProtocolError";

	/** The protocol {@link ErrorCode} returned by the server. */
	readonly code: ErrorCode;

	/**
	 * @param code - The protocol error code
	 * @param message - Human-readable error description
	 * @param cause - The underlying error that caused this failure
	 */
	constructor(code: ErrorCode, message: string, cause?: Error) {
		super(message, cause);
		this.code = code;
	}
}

/** Error thrown when a device-specific operation fails. */
export class DeviceError extends ButtplugError {
	override readonly name: string = "DeviceError";

	/** Index of the device that triggered the error. */
	readonly deviceIndex: number;

	/**
	 * @param deviceIndex - Index of the device that triggered the error
	 * @param message - Human-readable error description
	 * @param cause - The underlying error that caused this failure
	 */
	constructor(deviceIndex: number, message: string, cause?: Error) {
		super(message, cause);
		this.deviceIndex = deviceIndex;
	}
}

/** Error thrown when an operation exceeds its allowed duration. */
export class TimeoutError extends ButtplugError {
	override readonly name: string = "TimeoutError";

	/** Name of the operation that timed out. */
	readonly operation: string;

	/** Duration in milliseconds before the timeout triggered. */
	readonly timeoutMs: number;

	/**
	 * @param operation - Name of the operation that timed out
	 * @param timeoutMs - Duration in milliseconds before the timeout triggered
	 * @param cause - The underlying error that caused this failure
	 */
	constructor(operation: string, timeoutMs: number, cause?: Error) {
		super(`${operation} timed out after ${timeoutMs}ms`, cause);
		this.operation = operation;
		this.timeoutMs = timeoutMs;
	}
}

/**
 * Normalizes an unknown thrown value into a human-readable message.
 *
 * @param err - The caught value to format
 * @returns Error message for Error instances, stringified value otherwise
 */
export function formatError(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

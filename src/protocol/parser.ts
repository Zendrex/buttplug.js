import type { Logger } from "../lib/logger";
import type { DeviceList, ErrorMsg, InputReading, Ok, ScanningFinished, ServerInfo, ServerMessage } from "./schema";

import { noopLogger } from "../lib/logger";
import { ServerMessageSchema } from "./schema";

/**
 * Union of all top-level keys that can appear in a {@link ServerMessage}.
 *
 * Useful for switching on message type without hardcoding string literals.
 */
type ExtractKeys<T> = T extends Record<infer K, unknown> ? K : never;
export type ServerMessageType = ExtractKeys<ServerMessage>;

/**
 * Parses a raw JSON string from a Buttplug server into validated {@link ServerMessage} instances.
 *
 * The Buttplug protocol transmits messages as JSON arrays. Each element is validated
 * against {@link ServerMessageSchema}; unrecognized message types are logged and skipped
 * rather than throwing, to allow forward-compatible handling of newer server versions.
 *
 * @param raw - Raw JSON string received from the server
 * @param logger - Optional logger for warnings about unrecognized message types
 * @returns Array of validated server messages
 * @throws Error if the JSON is not a non-empty array or contains non-object elements
 */
export function parseServerMessages(raw: string, logger: Logger = noopLogger): ServerMessage[] {
	const parsed: unknown = JSON.parse(raw);

	if (!Array.isArray(parsed) || parsed.length === 0) {
		throw new Error("Invalid server message: expected non-empty array");
	}

	const messages: ServerMessage[] = [];

	for (const element of parsed) {
		if (typeof element !== "object" || element === null) {
			throw new Error("Invalid server message: expected object");
		}
		const keys = Object.keys(element);
		if (keys.length !== 1) {
			throw new Error(`Invalid server message: expected exactly one key, got ${keys.length}`);
		}
		const result = ServerMessageSchema.safeParse(element);
		if (result.success) {
			messages.push(result.data);
		} else {
			logger.warn(`Unknown server message type: ${keys[0]}`);
		}
	}

	return messages;
}

/**
 * Extracts the message type key from a {@link ServerMessage}.
 *
 * Used to discriminate the tagged union without hardcoding string literals.
 *
 * @param message - A validated server message
 * @returns The single top-level key identifying the message type
 * @throws Error if the message does not have exactly one key
 */
export function getMessageType(message: ServerMessage): ServerMessageType {
	const keys = Object.keys(message);
	if (keys.length !== 1) {
		throw new Error("Invalid message: expected exactly one key");
	}
	// Type assertion safe: keys[0] is guaranteed to be a valid ServerMessageType
	// because the message was parsed by ServerMessageSchema
	return keys[0] as ServerMessageType;
}

/**
 * Extracts the correlation ID from a {@link ServerMessage}.
 *
 * Every Buttplug message wraps an inner object containing an `Id` field
 * used for request/response correlation.
 *
 * @param message - A validated server message
 * @returns The numeric message ID
 * @throws Error if the inner message has no valid Id field
 */
export function extractId(message: ServerMessage): number {
	const type = getMessageType(message);
	// Type assertion safe: ServerMessage is always a single-key object wrapping a BaseMessage
	const inner = (message as Record<string, Record<string, unknown>>)[type];
	if (typeof inner?.Id !== "number") {
		throw new Error(`Message type "${type}" has no valid Id field`);
	}
	return inner.Id;
}

// ============================================================================
// Type Guards
// ============================================================================

/** Narrows {@link ServerMessage} to the ServerInfo variant. */
export function isServerInfo(message: ServerMessage): message is { ServerInfo: ServerInfo } {
	return "ServerInfo" in message;
}

/** Narrows {@link ServerMessage} to the Ok variant. */
export function isOk(message: ServerMessage): message is { Ok: Ok } {
	return "Ok" in message;
}

/** Narrows {@link ServerMessage} to the Error variant. */
export function isError(message: ServerMessage): message is { Error: ErrorMsg } {
	return "Error" in message;
}

/** Narrows {@link ServerMessage} to the DeviceList variant. */
export function isDeviceList(message: ServerMessage): message is { DeviceList: DeviceList } {
	return "DeviceList" in message;
}

/** Narrows {@link ServerMessage} to the ScanningFinished variant. */
export function isScanningFinished(message: ServerMessage): message is { ScanningFinished: ScanningFinished } {
	return "ScanningFinished" in message;
}

/** Narrows {@link ServerMessage} to the InputReading variant. */
export function isInputReading(message: ServerMessage): message is { InputReading: InputReading } {
	return "InputReading" in message;
}

// ============================================================================
// Content Extractors
// ============================================================================

/** Extracts the {@link ServerInfo} payload from a narrowed message. */
export function getServerInfo(message: { ServerInfo: ServerInfo }): ServerInfo {
	return message.ServerInfo;
}

/** Extracts the {@link ErrorMsg} payload from a narrowed message. */
export function getError(message: { Error: ErrorMsg }): ErrorMsg {
	return message.Error;
}

/** Extracts the {@link DeviceList} payload from a narrowed message. */
export function getDeviceList(message: { DeviceList: DeviceList }): DeviceList {
	return message.DeviceList;
}

/** Extracts the {@link InputReading} payload from a narrowed message. */
export function getInputReading(message: { InputReading: InputReading }): InputReading {
	return message.InputReading;
}

import { ErrorCode, ProtocolError } from "../lib/errors";
import { noopLogger } from "../lib/logger";
import { ServerMessageSchema } from "./schema";
import type { Logger } from "../lib/logger";
import type { DeviceList, ErrorMsg, InputReading, Ok, ScanningFinished, ServerInfo, ServerMessage } from "./schema";

type ExtractKeys<T> = T extends Record<infer K, unknown> ? K : never;
type ServerMessageType = ExtractKeys<ServerMessage>;

export function parseServerMessages(raw: string, logger: Logger = noopLogger): ServerMessage[] {
	const log = logger.child("parse");
	const parsed: unknown = JSON.parse(raw);

	if (!Array.isArray(parsed) || parsed.length === 0) {
		throw new ProtocolError(ErrorCode.MESSAGE, "Invalid server message: expected non-empty array");
	}

	const messages: ServerMessage[] = [];

	for (const element of parsed) {
		if (typeof element !== "object" || element === null) {
			throw new ProtocolError(ErrorCode.MESSAGE, "Invalid server message: expected object");
		}
		const keys = Object.keys(element);
		if (keys.length !== 1) {
			throw new ProtocolError(
				ErrorCode.MESSAGE,
				`Invalid server message: expected exactly one key, got ${keys.length}`
			);
		}
		const result = ServerMessageSchema.safeParse(element);
		if (result.success) {
			messages.push(result.data);
		} else {
			log.warn(`Unknown server message type: ${keys[0]}`);
		}
	}

	return messages;
}

export function extractId(message: ServerMessage): number {
	const type = getMessageType(message);
	const inner = (message as Record<string, Record<string, unknown>>)[type];
	if (typeof inner?.Id !== "number") {
		throw new ProtocolError(ErrorCode.MESSAGE, `Message type "${type}" has no valid Id field`);
	}
	return inner.Id;
}

export function isServerInfo(message: ServerMessage): message is { ServerInfo: ServerInfo } {
	return "ServerInfo" in message;
}

export function isOk(message: ServerMessage): message is { Ok: Ok } {
	return "Ok" in message;
}

export function isError(message: ServerMessage): message is { Error: ErrorMsg } {
	return "Error" in message;
}

export function isDeviceList(message: ServerMessage): message is { DeviceList: DeviceList } {
	return "DeviceList" in message;
}

export function isScanningFinished(message: ServerMessage): message is { ScanningFinished: ScanningFinished } {
	return "ScanningFinished" in message;
}

export function isInputReading(message: ServerMessage): message is { InputReading: InputReading } {
	return "InputReading" in message;
}

export function getServerInfo(message: { ServerInfo: ServerInfo }): ServerInfo {
	return message.ServerInfo;
}

export function getError(message: { Error: ErrorMsg }): ErrorMsg {
	return message.Error;
}

export function getDeviceList(message: { DeviceList: DeviceList }): DeviceList {
	return message.DeviceList;
}

export function getInputReading(message: { InputReading: InputReading }): InputReading {
	return message.InputReading;
}

function getMessageType(message: ServerMessage): ServerMessageType {
	const keys = Object.keys(message);
	if (keys.length !== 1) {
		throw new ProtocolError(ErrorCode.MESSAGE, "Invalid message: expected exactly one key");
	}
	return keys[0] as ServerMessageType;
}

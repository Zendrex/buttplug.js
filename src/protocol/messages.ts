import type { ClientMessage, InputCommandType, InputType, OutputCommand } from "./schema";

import { PROTOCOL_VERSION_MAJOR, PROTOCOL_VERSION_MINOR } from "./constants";

/**
 * Creates a {@link ClientMessage} to initiate the handshake with a Buttplug server.
 *
 * @param id - Unique message identifier for request/response correlation
 * @param clientName - Human-readable name identifying this client to the server
 * @returns A validated RequestServerInfo client message
 */
export function createRequestServerInfo(id: number, clientName: string): ClientMessage {
	return {
		RequestServerInfo: {
			Id: id,
			ClientName: clientName,
			ProtocolVersionMajor: PROTOCOL_VERSION_MAJOR,
			ProtocolVersionMinor: PROTOCOL_VERSION_MINOR,
		},
	};
}

/**
 * Creates a {@link ClientMessage} to begin scanning for devices.
 *
 * @param id - Unique message identifier for request/response correlation
 * @returns A validated StartScanning client message
 */
export function createStartScanning(id: number): ClientMessage {
	return {
		StartScanning: { Id: id },
	};
}

/**
 * Creates a {@link ClientMessage} to stop an ongoing device scan.
 *
 * @param id - Unique message identifier for request/response correlation
 * @returns A validated StopScanning client message
 */
export function createStopScanning(id: number): ClientMessage {
	return {
		StopScanning: { Id: id },
	};
}

/**
 * Creates a {@link ClientMessage} to request the current list of connected devices.
 *
 * @param id - Unique message identifier for request/response correlation
 * @returns A validated RequestDeviceList client message
 */
export function createRequestDeviceList(id: number): ClientMessage {
	return {
		RequestDeviceList: { Id: id },
	};
}

/**
 * Creates a {@link ClientMessage} to send a keep-alive ping to the server.
 *
 * @param id - Unique message identifier for request/response correlation
 * @returns A validated Ping client message
 */
export function createPing(id: number): ClientMessage {
	return {
		Ping: { Id: id },
	};
}

/**
 * Creates a {@link ClientMessage} to gracefully disconnect from the server.
 *
 * @param id - Unique message identifier for request/response correlation
 * @returns A validated Disconnect client message
 */
export function createDisconnect(id: number): ClientMessage {
	return {
		Disconnect: { Id: id },
	};
}

/**
 * Creates a {@link ClientMessage} to stop device activity.
 *
 * Can target a specific device, feature, or all devices depending on which
 * options are provided. Omitting all options stops everything.
 *
 * @param id - Unique message identifier for request/response correlation
 * @param options - Optional targeting filters for the stop command
 * @returns A validated StopCmd client message
 */
export function createStopCmd(
	id: number,
	options?: {
		deviceIndex?: number;
		featureIndex?: number;
		inputs?: boolean;
		outputs?: boolean;
	}
): ClientMessage {
	if (options?.featureIndex !== undefined && options.deviceIndex === undefined) {
		throw new Error("StopCmd: featureIndex requires deviceIndex to be set");
	}

	return {
		StopCmd: {
			Id: id,
			...(options?.deviceIndex !== undefined && { DeviceIndex: options.deviceIndex }),
			...(options?.featureIndex !== undefined && { FeatureIndex: options.featureIndex }),
			...(options?.inputs !== undefined && { Inputs: options.inputs }),
			...(options?.outputs !== undefined && { Outputs: options.outputs }),
		},
	};
}

/**
 * Creates a {@link ClientMessage} to send an output command to a device feature.
 *
 * @param options - Output command parameters including device/feature targeting and the command payload
 * @returns A validated OutputCmd client message
 */
export function createOutputCmd(options: {
	id: number;
	deviceIndex: number;
	featureIndex: number;
	command: OutputCommand;
}): ClientMessage {
	return {
		OutputCmd: {
			Id: options.id,
			DeviceIndex: options.deviceIndex,
			FeatureIndex: options.featureIndex,
			Command: options.command,
		},
	};
}

/**
 * Creates a {@link ClientMessage} to send an input command (read/subscribe/unsubscribe) to a device sensor.
 *
 * @param options - Input command parameters including device/feature targeting, sensor type, and command
 * @returns A validated InputCmd client message
 */
export function createInputCmd(options: {
	id: number;
	deviceIndex: number;
	featureIndex: number;
	inputType: InputType;
	command: InputCommandType;
}): ClientMessage {
	return {
		InputCmd: {
			Id: options.id,
			DeviceIndex: options.deviceIndex,
			FeatureIndex: options.featureIndex,
			Type: options.inputType,
			Command: options.command,
		},
	};
}

/**
 * Serializes a single {@link ClientMessage} into a JSON array string.
 *
 * The Buttplug protocol requires messages to be sent as JSON arrays,
 * even when sending a single message.
 *
 * @param message - The client message to serialize
 * @returns JSON string containing a single-element array
 */
export function serializeMessage(message: ClientMessage): string {
	return JSON.stringify([message]);
}

/**
 * Serializes multiple {@link ClientMessage} instances into a JSON array string.
 *
 * @param messages - Array of client messages to serialize
 * @returns JSON string containing the message array
 */
export function serializeMessages(messages: ClientMessage[]): string {
	return JSON.stringify(messages);
}

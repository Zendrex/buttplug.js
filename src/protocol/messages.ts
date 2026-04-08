import { ErrorCode, ProtocolError } from "../lib/errors";
import { PROTOCOL_VERSION_MAJOR, PROTOCOL_VERSION_MINOR } from "./constants";
import type { ClientMessage } from "./schema";

/**
 * Creates a {@link ClientMessage} to initiate the handshake with a Buttplug server.
 *
 * @param id - Unique message identifier for request/response correlation
 * @param clientName - Human-readable name identifying this client to the server
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

/** Creates a StartScanning {@link ClientMessage}. */
export function createStartScanning(id: number): ClientMessage {
	return {
		StartScanning: { Id: id },
	};
}

/** Creates a StopScanning {@link ClientMessage}. */
export function createStopScanning(id: number): ClientMessage {
	return {
		StopScanning: { Id: id },
	};
}

/** Creates a RequestDeviceList {@link ClientMessage}. */
export function createRequestDeviceList(id: number): ClientMessage {
	return {
		RequestDeviceList: { Id: id },
	};
}

/** Creates a Ping {@link ClientMessage}. */
export function createPing(id: number): ClientMessage {
	return {
		Ping: { Id: id },
	};
}

/** Creates a Disconnect {@link ClientMessage}. */
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
		throw new ProtocolError(ErrorCode.MESSAGE, "StopCmd: featureIndex requires deviceIndex to be set");
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

/** Serializes multiple {@link ClientMessage} instances into a JSON array string. */
export function serializeMessages(messages: ClientMessage[]): string {
	return JSON.stringify(messages);
}

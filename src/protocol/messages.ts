import { ErrorCode, ProtocolError } from "../lib/errors";
import { PROTOCOL_VERSION_MAJOR, PROTOCOL_VERSION_MINOR } from "./constants";
import type { ClientMessage } from "./schema";

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

export function createStartScanning(id: number): ClientMessage {
	return {
		StartScanning: { Id: id },
	};
}

export function createStopScanning(id: number): ClientMessage {
	return {
		StopScanning: { Id: id },
	};
}

export function createRequestDeviceList(id: number): ClientMessage {
	return {
		RequestDeviceList: { Id: id },
	};
}

export function createPing(id: number): ClientMessage {
	return {
		Ping: { Id: id },
	};
}

export function createDisconnect(id: number): ClientMessage {
	return {
		Disconnect: { Id: id },
	};
}

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

export function serializeMessages(messages: ClientMessage[]): string {
	return JSON.stringify(messages);
}

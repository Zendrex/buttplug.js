import { HandshakeError } from "../lib/errors";
import { noopLogger } from "../lib/logger";
import { PROTOCOL_VERSION_MAJOR, PROTOCOL_VERSION_MINOR } from "../protocol/constants";
import { createRequestServerInfo } from "../protocol/messages";
import { isServerInfo } from "../protocol/parser";
import type { Logger } from "../lib/logger";
import type { ServerInfo, ServerMessage } from "../protocol/schema";
import type { PingManager } from "../transport/ping";
import type { MessageRouter } from "./message-router";

export type HandshakeResult = ServerInfo;

export interface HandshakeOptions {
	clientName: string;
	logger?: Logger;
	pingManager: PingManager;
	router: MessageRouter;
}

export async function performHandshake(options: HandshakeOptions): Promise<HandshakeResult> {
	const { router, clientName, pingManager, logger = noopLogger } = options;
	const log = logger.child("handshake");
	let response: ServerMessage;
	try {
		const responses = await router.send(createRequestServerInfo(router.nextId(), clientName));
		response = responses[0] as ServerMessage;
	} catch (err) {
		throw new HandshakeError(
			`Handshake failed: ${err instanceof Error ? err.message : String(err)}`,
			err instanceof Error ? err : undefined
		);
	}
	if (!isServerInfo(response)) {
		throw new HandshakeError("Handshake failed: unexpected response type");
	}
	const serverInfo = response.ServerInfo;
	if (serverInfo.ProtocolVersionMajor !== PROTOCOL_VERSION_MAJOR) {
		throw new HandshakeError(
			`Server protocol version ${serverInfo.ProtocolVersionMajor} is incompatible (client requires ${PROTOCOL_VERSION_MAJOR})`
		);
	}
	const negotiatedMinor = Math.min(PROTOCOL_VERSION_MINOR, serverInfo.ProtocolVersionMinor);
	log.info(`Protocol version negotiated: ${PROTOCOL_VERSION_MAJOR}.${negotiatedMinor}`);
	pingManager.start(serverInfo.MaxPingTime);
	return serverInfo;
}

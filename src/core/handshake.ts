import type { Logger } from "../lib/logger";
import type { ServerInfo, ServerMessage } from "../protocol/schema";
import type { PingManager } from "../transport/ping";
import type { MessageRouter } from "./message-router";

import { HandshakeError } from "../lib/errors";
import { noopLogger } from "../lib/logger";
import { PROTOCOL_VERSION_MAJOR, PROTOCOL_VERSION_MINOR } from "../protocol/constants";
import { createRequestServerInfo } from "../protocol/messages";
import { getServerInfo, isServerInfo } from "../protocol/parser";

/**
 * Result of a successful handshake containing server capabilities.
 * Alias for {@link ServerInfo} from the protocol package.
 */
export type HandshakeResult = ServerInfo;

/**
 * Configuration for {@link performHandshake}.
 */
export interface HandshakeOptions {
	/** Client name sent to the server for identification. */
	clientName: string;
	/** Logger for handshake diagnostics. Falls back to noop if omitted. */
	logger?: Logger;
	/** Ping manager to start after a successful handshake. */
	pingManager: PingManager;
	/** Router to send the handshake request through. */
	router: MessageRouter;
}

/**
 * Performs the buttplug protocol handshake with a connected server.
 *
 * Sends a RequestServerInfo message, validates the response type and protocol version
 * compatibility, then starts the ping manager with the server's max ping time.
 *
 * @param options - Handshake configuration
 * @returns The server's info including protocol version and capabilities
 * @throws {HandshakeError} if the request fails, the response is unexpected,
 *   or the server's protocol version is incompatible
 */
export async function performHandshake(options: HandshakeOptions): Promise<HandshakeResult> {
	const { router, clientName, pingManager, logger = noopLogger } = options;
	let response: ServerMessage;
	try {
		const responses = await router.send(createRequestServerInfo(router.nextId(), clientName));
		// Type assertion safe: router.send always returns one response per message sent
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
	const serverInfo = getServerInfo(response);
	// Spec: Version Negotiation Rules
	// If the server is newer, it should downgrade and report the client's version.
	// If the client is newer, the server should have sent an Error instead of ServerInfo.
	// In either case, a mismatch in the reported major version means an incompatible connection.
	if (serverInfo.ProtocolVersionMajor !== PROTOCOL_VERSION_MAJOR) {
		throw new HandshakeError(
			`Server protocol version ${serverInfo.ProtocolVersionMajor} is incompatible (client requires ${PROTOCOL_VERSION_MAJOR})`
		);
	}
	// Spec: Minor Version Rules — log the negotiated minor version for diagnostics
	const negotiatedMinor = Math.min(PROTOCOL_VERSION_MINOR, serverInfo.ProtocolVersionMinor);
	logger.info(`Protocol version negotiated: ${PROTOCOL_VERSION_MAJOR}.${negotiatedMinor}`);
	pingManager.start(serverInfo.MaxPingTime);
	return serverInfo;
}

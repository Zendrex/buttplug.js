import type { Logger } from "../lib/logger";
import type { ClientMessage, ErrorMsg, InputReading, RawDevice, ServerMessage } from "../protocol/schema";
import type { MessageRouterOptions, PendingRequest } from "./types";

import { ErrorCode, formatError, ProtocolError, TimeoutError } from "../lib/errors";
import { noopLogger } from "../lib/logger";
import { DEFAULT_REQUEST_TIMEOUT, MAX_MESSAGE_ID } from "../protocol/constants";
import { serializeMessages } from "../protocol/messages";
import {
	extractId,
	getDeviceList,
	getError,
	getInputReading,
	isDeviceList,
	isError,
	isInputReading,
	isOk,
	isScanningFinished,
	isServerInfo,
	parseServerMessages,
} from "../protocol/parser";

/**
 * Routes buttplug protocol messages between the client and server.
 *
 * Handles request/response correlation via message IDs, automatic timeout management,
 * and dispatches unsolicited server events (device lists, scanning status, sensor readings,
 * errors) to registered callbacks.
 */
export class MessageRouter {
	/** In-flight requests awaiting server responses, keyed by message ID. */
	readonly #pending = new Map<number, PendingRequest>();
	readonly #send: (data: string) => void;
	readonly #timeout: number;
	readonly #logger: Logger;
	readonly #onDeviceList?: (devices: RawDevice[]) => void;
	readonly #onScanningFinished?: () => void;
	readonly #onInputReading?: (reading: InputReading) => void;
	readonly #onError?: (error: ErrorMsg) => void;
	#messageId = 0;

	/**
	 * @param options - Router configuration including transport function and event callbacks
	 */
	constructor(options: MessageRouterOptions) {
		this.#send = options.send;
		this.#timeout = options.timeout ?? DEFAULT_REQUEST_TIMEOUT;
		this.#logger = (options.logger ?? noopLogger).child("router");
		this.#onDeviceList = options.onDeviceList;
		this.#onScanningFinished = options.onScanningFinished;
		this.#onInputReading = options.onInputReading;
		this.#onError = options.onError;
	}

	/**
	 * Returns the next message ID, wrapping around at {@link MAX_MESSAGE_ID}.
	 *
	 * @returns A monotonically increasing ID for use in outgoing messages
	 */
	nextId(): number {
		this.#messageId = (this.#messageId % MAX_MESSAGE_ID) + 1;
		return this.#messageId;
	}

	/**
	 * Sends one or more client messages and returns promises for their responses.
	 *
	 * Each message is tracked by its ID with an automatic timeout. If the transport
	 * function throws, all pending requests from this batch are cleaned up.
	 *
	 * @param input - A single message or array of messages to send
	 * @returns A promise resolving to an array of server responses, one per input message
	 * @throws {TimeoutError} if a response is not received within the configured timeout
	 * @throws {ProtocolError} if a message has an invalid structure
	 */
	send(input: ClientMessage | ClientMessage[]): Promise<ServerMessage[]> {
		const messages = Array.isArray(input) ? input : [input];
		const serialized = serializeMessages(messages);
		const label = messages.length === 1 ? "message" : `batch (${messages.length})`;
		this.#logger.debug(`Sending ${label}: ${serialized}`);

		const promises = messages.map((message) => {
			const id = this.#extractMessageId(message);
			return new Promise<ServerMessage>((resolve, reject) => {
				const timeoutHandle = setTimeout(() => {
					this.#pending.delete(id);
					reject(new TimeoutError(`Request (ID ${id})`, this.#timeout));
				}, this.#timeout);

				this.#pending.set(id, {
					resolve,
					reject: (err: Error) => {
						clearTimeout(timeoutHandle);
						reject(err);
					},
					timeout: timeoutHandle,
				});
			});
		});

		try {
			this.#send(serialized);
		} catch (err) {
			const ids = messages.map((m) => this.#extractMessageId(m));
			for (const id of ids) {
				const pending = this.#pending.get(id);
				if (pending?.timeout) {
					clearTimeout(pending.timeout);
				}
				this.#pending.delete(id);
			}
			throw err instanceof Error ? err : new Error(String(err));
		}

		return Promise.all(promises);
	}

	/**
	 * Processes a raw incoming message string from the server.
	 *
	 * Parses the JSON, then routes each message to its pending request or to
	 * the appropriate event callback.
	 *
	 * @param raw - The raw JSON string received from the server
	 */
	handleMessage(raw: string): void {
		this.#logger.debug(`Received message: ${raw}`);
		let messages: ServerMessage[];
		try {
			messages = parseServerMessages(raw, this.#logger);
		} catch (err) {
			this.#logger.error(`Failed to parse message: ${formatError(err)}`);
			return;
		}
		for (const message of messages) {
			this.#processMessage(message);
		}
	}

	/**
	 * Cancels a single pending request by ID, rejecting its promise with the given error.
	 *
	 * @param id - The message ID of the request to cancel
	 * @param error - The error to reject the pending promise with
	 */
	cancelPending(id: number, error: Error): void {
		const pending = this.#pending.get(id);
		if (pending) {
			if (pending.timeout !== null) {
				clearTimeout(pending.timeout);
			}
			this.#pending.delete(id);
			pending.reject(error);
		}
	}

	/**
	 * Cancels all pending requests, rejecting each with the given error.
	 *
	 * @param error - The error to reject all pending promises with
	 */
	cancelAll(error: Error): void {
		const entries = Array.from(this.#pending.values());
		this.#pending.clear();
		for (const pending of entries) {
			if (pending.timeout !== null) {
				clearTimeout(pending.timeout);
			}
			pending.reject(error);
		}
	}

	/** Resets the message ID counter — required after reconnect to avoid collision with old IDs. */
	resetId(): void {
		this.#messageId = 0;
	}

	/** Number of in-flight requests currently awaiting responses. */
	get pendingCount(): number {
		return this.#pending.size;
	}

	/**
	 * Routes a parsed message to its pending request or to the event handler.
	 * Messages with ID 0 or unmatched IDs are treated as unsolicited events.
	 */
	#processMessage(message: ServerMessage): void {
		const id = extractId(message);
		if (id === 0) {
			this.#routeEvent(message);
			return;
		}

		const pending = this.#pending.get(id);
		if (!pending) {
			this.#routeEvent(message);
			return;
		}

		if (pending.timeout !== null) {
			clearTimeout(pending.timeout);
		}
		this.#pending.delete(id);

		if (isOk(message) || isServerInfo(message) || isInputReading(message)) {
			pending.resolve(message);
			return;
		}
		if (isError(message)) {
			const error = getError(message);
			pending.reject(new ProtocolError(error.ErrorCode, error.ErrorMessage));
			return;
		}
		if (isDeviceList(message)) {
			pending.resolve(message);
			return;
		}
		this.#logger.warn(`Unexpected response type for pending request ${id}`);
		pending.resolve(message);
	}

	/**
	 * Dispatches an unsolicited server event to the appropriate callback.
	 * Logs a warning if the message type has no registered handler.
	 */
	#routeEvent(message: ServerMessage): void {
		if (isDeviceList(message)) {
			const deviceList = getDeviceList(message);
			this.#onDeviceList?.(Object.values(deviceList.Devices));
			return;
		}
		if (isScanningFinished(message)) {
			this.#onScanningFinished?.();
			return;
		}
		if (isInputReading(message)) {
			const reading = getInputReading(message);
			this.#onInputReading?.(reading);
			return;
		}
		if (isError(message)) {
			const error = getError(message);
			this.#onError?.(error);
			return;
		}
		this.#logger.warn(`Unexpected message type: ${JSON.stringify(message)}`);
	}

	/**
	 * Extracts the numeric message ID from a client message envelope.
	 * @throws {ProtocolError} if the message is malformed or missing an ID
	 */
	#extractMessageId(message: ClientMessage): number {
		const keys = Object.keys(message);
		if (keys.length !== 1) {
			throw new ProtocolError(ErrorCode.MESSAGE, "Invalid message: expected exactly one key");
		}
		// Type assertion safe: we verified exactly one key exists above
		const inner = message[keys[0] as keyof ClientMessage] as { Id?: unknown };
		if (typeof inner.Id !== "number") {
			throw new ProtocolError(ErrorCode.MESSAGE, "Invalid message: missing or non-numeric Id field");
		}
		return inner.Id;
	}
}

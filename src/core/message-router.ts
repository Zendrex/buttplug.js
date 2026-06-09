import { ErrorCode, formatError, ProtocolError, TimeoutError } from "../lib/errors";
import { noopLogger } from "../lib/logger";
import { DEFAULT_REQUEST_TIMEOUT, MAX_MESSAGE_ID, SYSTEM_MESSAGE_ID } from "../protocol/constants";
import { serializeMessages } from "../protocol/messages";
import {
	extractId,
	isDeviceList,
	isError,
	isInputReading,
	isOk,
	isScanningFinished,
	isServerInfo,
	parseServerMessages,
} from "../protocol/parser";
import type { Logger } from "../lib/logger";
import type { ClientMessage, ErrorMsg, InputReading, RawDevice, ServerMessage } from "../protocol/schema";

export interface PendingRequest<T = ServerMessage> {
	reject: (error: Error) => void;
	resolve: (value: T) => void;
	timeout: ReturnType<typeof setTimeout> | null;
}

export interface MessageRouterOptions {
	logger?: Logger;
	onDeviceList?: (devices: RawDevice[]) => void;
	onError?: (error: ErrorMsg) => void;
	onInputReading?: (reading: InputReading) => void;
	onScanningFinished?: () => void;
	send: (data: string) => void;
	timeout?: number;
}

export class MessageRouter {
	private readonly _send: (data: string) => void;
	private readonly timeout: number;
	private readonly logger: Logger;
	private readonly onDeviceList?: (devices: RawDevice[]) => void;
	private readonly onScanningFinished?: () => void;
	private readonly onInputReading?: (reading: InputReading) => void;
	private readonly onError?: (error: ErrorMsg) => void;
	private readonly pending = new Map<number, PendingRequest>();
	private messageId = 0;

	constructor(options: MessageRouterOptions) {
		this._send = options.send;
		this.timeout = options.timeout ?? DEFAULT_REQUEST_TIMEOUT;
		this.logger = (options.logger ?? noopLogger).child("router");
		this.onDeviceList = options.onDeviceList;
		this.onScanningFinished = options.onScanningFinished;
		this.onInputReading = options.onInputReading;
		this.onError = options.onError;
	}

	nextId(): number {
		this.messageId = (this.messageId % MAX_MESSAGE_ID) + 1;
		return this.messageId;
	}

	send(input: ClientMessage | ClientMessage[]): Promise<ServerMessage[]> {
		const messages = Array.isArray(input) ? input : [input];
		const serialized = serializeMessages(messages);
		const label = messages.length === 1 ? "message" : `batch (${messages.length})`;
		this.logger.debug(`Sending ${label}: ${serialized}`);

		const ids = messages.map((m) => this.extractId(m));
		const promises = ids.map(
			(id) =>
				new Promise<ServerMessage>((resolve, reject) => {
					const timeoutHandle = setTimeout(() => {
						this.pending.delete(id);
						reject(new TimeoutError(`Request (ID ${id})`, this.timeout));
					}, this.timeout);

					const existing = this.pending.get(id);
					if (existing) {
						if (existing.timeout !== null) {
							clearTimeout(existing.timeout);
						}
						existing.reject(
							new ProtocolError(ErrorCode.MESSAGE, `Request ${id} superseded by new request`)
						);
					}

					this.pending.set(id, {
						resolve,
						reject: (err: Error) => {
							clearTimeout(timeoutHandle);
							reject(err);
						},
						timeout: timeoutHandle,
					});
				})
		);

		try {
			this._send(serialized);
		} catch (err) {
			for (const id of ids) {
				const pending = this.pending.get(id);
				if (pending?.timeout) {
					clearTimeout(pending.timeout);
				}
				this.pending.delete(id);
			}
			throw err instanceof Error ? err : new Error(String(err));
		}

		return Promise.all(promises);
	}

	handleMessage(raw: string): void {
		this.logger.debug(`Received message: ${raw}`);
		let messages: ServerMessage[];
		try {
			messages = parseServerMessages(raw, this.logger);
		} catch (err) {
			this.logger.error(`Failed to parse message: ${formatError(err)}`);
			return;
		}
		const systemEvents: ServerMessage[] = [];
		for (const message of messages) {
			if (extractId(message) === SYSTEM_MESSAGE_ID) {
				systemEvents.push(message);
				continue;
			}
			this.processRequestMessage(message);
		}
		this.routeSystemEvents(systemEvents);
	}

	cancelPending(id: number, error: Error): void {
		const pending = this.pending.get(id);
		if (pending) {
			if (pending.timeout !== null) {
				clearTimeout(pending.timeout);
			}
			this.pending.delete(id);
			pending.reject(error);
		}
	}

	cancelAll(error: Error): void {
		const entries = Array.from(this.pending.values());
		this.pending.clear();
		for (const pending of entries) {
			if (pending.timeout !== null) {
				clearTimeout(pending.timeout);
			}
			pending.reject(error);
		}
	}

	resetId(): void {
		this.messageId = 0;
	}

	get pendingCount(): number {
		return this.pending.size;
	}

	private routeSystemEvents(messages: ServerMessage[]): void {
		if (messages.length === 0) {
			return;
		}
		// DeviceList must route before ScanningFinished so the post-scan refresh
		// (onScanningFinished -> requestDeviceList) sees the current device set.
		const ordered = [...messages].sort((a, b) => systemEventPriority(a) - systemEventPriority(b));
		for (const message of ordered) {
			this.routeEvent(message);
		}
	}

	private processRequestMessage(message: ServerMessage): void {
		const id = extractId(message);
		const pending = this.pending.get(id);
		if (!pending) {
			this.routeEvent(message);
			return;
		}

		if (pending.timeout !== null) {
			clearTimeout(pending.timeout);
		}
		this.pending.delete(id);

		if (isOk(message) || isServerInfo(message) || isInputReading(message)) {
			pending.resolve(message);
			return;
		}
		if (isError(message)) {
			const error = message.Error;
			pending.reject(new ProtocolError(error.ErrorCode, error.ErrorMessage));
			return;
		}
		if (isDeviceList(message)) {
			pending.resolve(message);
			return;
		}
		this.logger.warn(`Unexpected response type for pending request ${id}`);
		pending.resolve(message);
	}

	private routeEvent(message: ServerMessage): void {
		if (isDeviceList(message)) {
			const deviceList = message.DeviceList;
			this.onDeviceList?.(Object.values(deviceList.Devices));
			return;
		}
		if (isScanningFinished(message)) {
			this.onScanningFinished?.();
			return;
		}
		if (isInputReading(message)) {
			const reading = message.InputReading;
			this.onInputReading?.(reading);
			return;
		}
		if (isError(message)) {
			const error = message.Error;
			this.onError?.(error);
			return;
		}
		this.logger.warn(`Unexpected message type: ${JSON.stringify(message)}`);
	}

	private extractId(message: ClientMessage): number {
		const keys = Object.keys(message);
		if (keys.length !== 1) {
			throw new ProtocolError(ErrorCode.MESSAGE, "Invalid message: expected exactly one key");
		}
		const inner = message[keys[0] as keyof ClientMessage] as { Id?: unknown };
		if (typeof inner.Id !== "number") {
			throw new ProtocolError(ErrorCode.MESSAGE, "Invalid message: missing or non-numeric Id field");
		}
		return inner.Id;
	}
}

function systemEventPriority(message: ServerMessage): number {
	if (isDeviceList(message)) {
		return 0;
	}
	if (isScanningFinished(message)) {
		return 2;
	}
	return 1;
}

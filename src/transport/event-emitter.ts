import { formatError } from "../lib/errors";
import type { Logger } from "../lib/logger";
import type { TransportEventName, TransportEvents } from "./types";

/**
 * Shared listener registry for {@link Transport} implementations. Owns the
 * `on`/`off`/`emit` mechanics so each transport only implements its own
 * socket lifecycle. Handler exceptions are caught and logged, never rethrown.
 */
export abstract class TransportEventEmitter {
	private readonly listeners = new Map<TransportEventName, Set<TransportEvents[TransportEventName]>>();
	protected readonly logger: Logger;

	constructor(logger: Logger) {
		this.logger = logger;
	}

	on<E extends TransportEventName>(event: E, handler: TransportEvents[E]): void {
		let handlers = this.listeners.get(event);
		if (!handlers) {
			handlers = new Set();
			this.listeners.set(event, handlers);
		}
		handlers.add(handler);
	}

	off<E extends TransportEventName>(event: E, handler: TransportEvents[E]): void {
		this.listeners.get(event)?.delete(handler);
	}

	protected emit<E extends TransportEventName>(event: E, ...args: Parameters<TransportEvents[E]>): void {
		const handlers = this.listeners.get(event);
		if (!handlers) {
			return;
		}
		for (const handler of handlers) {
			try {
				(handler as (...a: unknown[]) => void)(...args);
			} catch (err) {
				this.logger.error(`Error in ${event} handler: ${formatError(err)}`);
			}
		}
	}
}

import type { Logger } from "./logger";

import { noopLogger } from "./logger";

/**
 * Module-scoped logger context for cross-cutting logging concerns.
 */
let currentLogger: Logger | undefined;

/**
 * Returns the {@link Logger} from the current context.
 *
 * Falls back to {@link noopLogger} when called outside a `runWithLogger` scope.
 *
 * @returns The context-scoped logger, or noop if none is set
 */
export function getLogger(): Logger {
	return currentLogger ?? noopLogger;
}

/**
 * Executes a function with the given {@link Logger} scoped to the
 * current synchronous call stack.
 *
 * All downstream calls to {@link getLogger} within `fn` will receive
 * the provided logger for the duration of the synchronous execution.
 *
 * @param logger - The logger to make available via `getLogger()`
 * @param fn - The function to execute within the scoped context
 * @returns The return value of `fn`
 */
export function runWithLogger<T>(logger: Logger, fn: () => T): T {
	const prev = currentLogger;
	currentLogger = logger;
	try {
		return fn();
	} finally {
		currentLogger = prev;
	}
}

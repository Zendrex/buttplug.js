// biome-ignore-all lint/suspicious/noConsole: logger intentionally uses console methods
// biome-ignore-all lint/suspicious/noEmptyBlockStatements: noop logger methods are intentionally empty

/**
 * Structured logging interface for Buttplug components.
 *
 * Supports hierarchical prefixes via {@link Logger.child} for scoped logging.
 */
export interface Logger {
	/**
	 * Creates a child logger with a nested prefix.
	 *
	 * @param prefix - Label appended to the parent prefix, separated by ':'
	 * @returns A new {@link Logger} with the combined prefix
	 */
	child(prefix: string): Logger;
	/** Logs a debug-level message. */
	debug(message: string): void;

	/** Logs an error-level message. */
	error(message: string): void;

	/** Logs an info-level message. */
	info(message: string): void;

	/** Logs a warning-level message. */
	warn(message: string): void;
}

/**
 * A logger that silently discards all messages.
 * Used as the default when no logging is configured.
 */
export const noopLogger: Logger = {
	debug() {},
	info() {},
	warn() {},
	error() {},
	child(): Logger {
		return noopLogger;
	},
};

/**
 * Creates a {@link Logger} that writes to the console with a bracketed prefix.
 *
 * @param prefix - Label prepended to all log messages
 * @returns A new console-backed logger
 */
function createLogger(prefix: string): Logger {
	return {
		debug(message: string) {
			console.debug(`[${prefix}] ${message}`);
		},
		info(message: string) {
			console.info(`[${prefix}] ${message}`);
		},
		warn(message: string) {
			console.warn(`[${prefix}] ${message}`);
		},
		error(message: string) {
			console.error(`[${prefix}] ${message}`);
		},
		child(childPrefix: string): Logger {
			return createLogger(`${prefix}:${childPrefix}`);
		},
	};
}

/** Default console logger prefixed with "buttplug". */
export const consoleLogger: Logger = createLogger("buttplug");

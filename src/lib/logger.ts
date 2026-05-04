export interface Logger {
	child(prefix: string): Logger;
	debug(message: string): void;
	error(message: string): void;
	info(message: string): void;
	warn(message: string): void;
}

export const noopLogger: Logger = {
	debug() {},
	info() {},
	warn() {},
	error() {},
	child(): Logger {
		return noopLogger;
	},
};

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
		child(childPrefix: string) {
			return createLogger(`${prefix}:${childPrefix}`);
		},
	};
}

export const consoleLogger: Logger = createLogger("buttplug");

export interface ResolveDiagnosticsLoggerOptions {
	logger?: Logger;
	verbose?: boolean;
}

export function resolveDiagnosticsLogger(options: ResolveDiagnosticsLoggerOptions = {}): Logger {
	if (options.logger !== undefined) {
		return options.logger;
	}
	if (options.verbose === true) {
		return consoleLogger;
	}
	return noopLogger;
}

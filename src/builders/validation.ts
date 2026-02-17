import { getLogger } from "../lib/context";

/**
 * Rounds and clamps a value to the given range, logging when clamping occurs.
 *
 * @param value - The raw numeric value to validate
 * @param range - Tuple of [min, max] defining the allowed range
 * @returns The rounded and clamped value within [min, max]
 */
export function validateRange(value: number, range: [number, number]): number {
	const [min, max] = range;
	const rounded = Math.round(value);
	const clamped = Math.max(min, Math.min(max, rounded));
	if (rounded !== clamped) {
		getLogger().debug(`Value ${value} clamped to ${clamped} (range [${min}, ${max}])`);
	}
	return clamped;
}

/** @see {@link validateRange} */
export function validateOutputValue(value: number, range: [number, number]): number {
	return validateRange(value, range);
}

/**
 * Validates that a command is supported.
 *
 * @param command - The command string to validate
 * @param supported - Array of supported command strings
 * @throws Error if the command is not in the supported list
 */
export function validateInputCommand(command: string, supported: string[]): void {
	if (!supported.includes(command)) {
		throw new Error(`Input command "${command}" is not supported. Supported commands: ${supported.join(", ")}`);
	}
}

/**
 * Clamp a normalized 0-1 float to the [0, 1] interval. Used as the front-door
 * validator for the high-level device API.
 */
export function clampNormalized(value: number): number {
	if (Number.isNaN(value)) {
		return 0;
	}
	return Math.max(0, Math.min(1, value));
}

/**
 * Clamp and round a raw protocol value to a device feature's integer range.
 * Used by `Device.output()` for the raw escape hatch that takes protocol-level
 * values rather than normalized 0-1 floats.
 */
export function validateRange(value: number, range: [number, number]): number {
	const [min, max] = range;
	const rounded = Math.round(value);
	return Math.max(min, Math.min(max, rounded));
}

/**
 * Map a normalized 0-1 float to a device feature's integer range. Values
 * outside [0, 1] are clamped before mapping.
 */
export function mapToRange(value: number, range: [number, number]): number {
	const clamped = clampNormalized(value);
	return Math.round(range[0] + clamped * (range[1] - range[0]));
}

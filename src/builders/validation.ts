/**
 * Rounds and clamps a value to the given range.
 *
 * @param value - The raw numeric value to validate
 * @param range - Tuple of [min, max] defining the allowed range
 * @returns The rounded and clamped value within [min, max]
 */
export function validateRange(value: number, range: [number, number]): number {
	const [min, max] = range;
	const rounded = Math.round(value);
	return Math.max(min, Math.min(max, rounded));
}

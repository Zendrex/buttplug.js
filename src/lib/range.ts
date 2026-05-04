export function validateRange(value: number, range: [number, number]): number {
	const [min, max] = range;
	const rounded = Math.round(value);
	return Math.max(min, Math.min(max, rounded));
}

export function mapToRange(value: number, range: [number, number]): number {
	return Math.round(range[0] + value * (range[1] - range[0]));
}

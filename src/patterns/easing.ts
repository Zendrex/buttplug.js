import type { Easing } from "./types";

/** Union of supported easing curve names, re-exported from {@link Easing}. */
export type EasingName = Easing;

/** A function that maps a normalized time value (0-1) to an eased output value. */
export type EasingFunction = (t: number) => number;

/** Clamps a time value to the 0-1 range. */
const clamp = (t: number): number => Math.min(1, Math.max(0, t));

/** Identity function returning the clamped input unchanged. */
const linear: EasingFunction = (t) => clamp(t);
/** Cubic ease-in curve with accelerating interpolation. */
const easeIn: EasingFunction = (t) => clamp(t) ** 3;
/** Cubic ease-out curve with decelerating interpolation. */
const easeOut: EasingFunction = (t) => 1 - (1 - clamp(t)) ** 3;
/** Cubic ease-in-out curve with smooth acceleration and deceleration. */
const easeInOut: EasingFunction = (t) => {
	const c = clamp(t);
	return c < 0.5 ? 4 * c ** 3 : 1 - (-2 * c + 2) ** 3 / 2;
};
/** Step function returning 0 before completion and 1 at completion. */
const step: EasingFunction = (t) => (clamp(t) < 1 ? 0 : 1);

/**
 * Lookup table mapping {@link EasingName} identifiers to their easing functions.
 *
 * All functions use cubic curves except `step` (discrete) and `linear` (identity).
 */
export const EASING_FUNCTIONS: Record<EasingName, EasingFunction> = {
	linear,
	easeIn,
	easeOut,
	easeInOut,
	step,
} as const;

/**
 * Applies an easing function to a normalized time value.
 *
 * Falls back to linear clamping if the easing name is not recognized.
 *
 * @param t - Normalized time value (0-1)
 * @param easing - Easing curve to apply
 * @returns Eased output value (0-1)
 */
export const ease = (t: number, easing: Easing): number => {
	const fn = EASING_FUNCTIONS[easing];
	return fn ? fn(t) : clamp(t);
};

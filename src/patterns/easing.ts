import { z } from "zod";

export const EASING_VALUES = ["linear", "easeIn", "easeOut", "easeInOut", "step"] as const;

export const EasingSchema = z.enum(EASING_VALUES);

export type Easing = z.infer<typeof EasingSchema>;

export type EasingName = Easing;

export type EasingFunction = (t: number) => number;

export const KeyframeSchema = z.object({
	value: z.number().min(0).max(1),
	duration: z.number().int().nonnegative(),
	easing: EasingSchema.optional(),
});

export type Keyframe = z.infer<typeof KeyframeSchema>;

const clamp = (t: number): number => Math.min(1, Math.max(0, t));

const linear: EasingFunction = (t) => clamp(t);

const easeIn: EasingFunction = (t) => clamp(t) ** 3;

const easeOut: EasingFunction = (t) => 1 - (1 - clamp(t)) ** 3;

const easeInOut: EasingFunction = (t) => {
	const c = clamp(t);
	return c < 0.5 ? 4 * c ** 3 : 1 - (-2 * c + 2) ** 3 / 2;
};

const step: EasingFunction = (t) => (clamp(t) < 1 ? 0 : 1);

export const EASING_FUNCTIONS: Record<EasingName, EasingFunction> = {
	linear,
	easeIn,
	easeOut,
	easeInOut,
	step,
} as const;

export const ease = (t: number, easing: Easing): number => {
	const fn = EASING_FUNCTIONS[easing];
	return fn ? fn(t) : clamp(t);
};

import { z } from "zod";

const NormalizedValueSchema = z.number().min(0).max(1);

const FeatureValueSchema = z.object({
	index: z.number().int(),
	value: NormalizedValueSchema,
});

export type FeatureValue = z.infer<typeof FeatureValueSchema>;

const RotationValueSchema = z.object({
	index: z.number().int(),
	speed: NormalizedValueSchema,
	clockwise: z.boolean(),
});

export type RotationValue = z.infer<typeof RotationValueSchema>;

const PositionValueSchema = z.object({
	index: z.number().int(),
	position: NormalizedValueSchema,
	duration: z.number().int().nonnegative(),
});

export type PositionValue = z.infer<typeof PositionValueSchema>;

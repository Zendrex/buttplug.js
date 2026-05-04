import { z } from "zod";

const FeatureValueSchema = z.object({
	index: z.number().int(),
	value: z.number().int(),
});

export type FeatureValue = z.infer<typeof FeatureValueSchema>;

const RotationValueSchema = z.object({
	index: z.number().int(),
	speed: z.number().int(),
	clockwise: z.boolean(),
});

export type RotationValue = z.infer<typeof RotationValueSchema>;

const PositionValueSchema = z.object({
	index: z.number().int(),
	position: z.number().int(),
	duration: z.number().int(),
});

export type PositionValue = z.infer<typeof PositionValueSchema>;

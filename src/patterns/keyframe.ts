import { z } from "zod";

import { EasingSchema } from "./easing";

export const KeyframeSchema = z.object({
	value: z.number().min(0).max(1),
	duration: z.number().int().nonnegative(),
	easing: EasingSchema.optional(),
});

export type Keyframe = z.infer<typeof KeyframeSchema>;

import { z } from "zod";

import { OutputTypeSchema } from "../protocol/schema";
import { KeyframeSchema } from "./keyframe";
import { PresetPatternSchema } from "./presets";

export const TrackSchema = z.object({
	featureIndex: z.number().int().nonnegative(),
	keyframes: z.array(KeyframeSchema).min(1),
	clockwise: z.boolean().optional(),
	outputType: OutputTypeSchema.optional(),
});

export type Track = z.infer<typeof TrackSchema>;

export const CustomPatternSchema = z.object({
	type: z.literal("custom"),
	tracks: z.array(TrackSchema).min(1),
	intensity: z.number().min(0).max(1).optional(),
	loop: z.union([z.boolean(), z.number().int().positive()]).optional(),
});

export type CustomPattern = z.infer<typeof CustomPatternSchema>;

export const PatternDescriptorSchema = z.discriminatedUnion("type", [PresetPatternSchema, CustomPatternSchema]);

export type PatternDescriptor = z.infer<typeof PatternDescriptorSchema>;

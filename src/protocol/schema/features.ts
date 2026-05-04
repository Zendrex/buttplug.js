import { z } from "zod";

import { InputTypeSchema, OutputTypeSchema } from "./primitives";

const OutputFeatureSchema = z.object({
	type: OutputTypeSchema,
	index: z.number().int(),
	description: z.string(),
	range: z.tuple([z.number().int(), z.number().int()]),
	durationRange: z.tuple([z.number().int(), z.number().int()]).optional(),
});

export type OutputFeature = z.infer<typeof OutputFeatureSchema>;

const InputFeatureSchema = z.object({
	type: InputTypeSchema,
	index: z.number().int(),
	description: z.string(),
	range: z.tuple([z.number().int(), z.number().int()]),
	canRead: z.boolean(),
	canSubscribe: z.boolean(),
});

export type InputFeature = z.infer<typeof InputFeatureSchema>;

const DeviceFeaturesSchema = z.object({
	outputs: z.array(OutputFeatureSchema),
	inputs: z.array(InputFeatureSchema),
});

export type DeviceFeatures = z.infer<typeof DeviceFeaturesSchema>;

import { z } from "zod";

import { BaseMessageSchema, InputCommandTypeSchema } from "./primitives";

const RawFeatureOutputSchema = z.object({
	Value: z.tuple([z.number().int(), z.number().int()]),
	Duration: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]).optional(),
});

export type RawFeatureOutput = z.infer<typeof RawFeatureOutputSchema>;

const RawFeatureInputSchema = z.object({
	Command: z.array(InputCommandTypeSchema),
	Value: z.array(z.tuple([z.number().int(), z.number().int()])),
});

export type RawFeatureInput = z.infer<typeof RawFeatureInputSchema>;

const RawDeviceFeatureSchema = z.object({
	FeatureIndex: z.number().int(),
	FeatureDescription: z.string(),
	Output: z.record(z.string(), RawFeatureOutputSchema).nullish(),
	Input: z.record(z.string(), RawFeatureInputSchema).nullish(),
});

export type RawDeviceFeature = z.infer<typeof RawDeviceFeatureSchema>;

const RawDeviceSchema = z.object({
	DeviceName: z.string(),
	DeviceIndex: z.number().int(),
	DeviceMessageTimingGap: z.number().int(),
	DeviceDisplayName: z.string().nullish(),
	DeviceFeatures: z.record(z.string(), RawDeviceFeatureSchema),
});

export type RawDevice = z.infer<typeof RawDeviceSchema>;

export const DeviceListSchema = BaseMessageSchema.extend({
	Devices: z.record(z.string(), RawDeviceSchema),
});

export type DeviceList = z.infer<typeof DeviceListSchema>;

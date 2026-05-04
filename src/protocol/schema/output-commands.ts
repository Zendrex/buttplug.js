import { z } from "zod";

import { BaseMessageSchema } from "./primitives";

const UnsignedScalarOutputDataSchema = z.object({
	Value: z.number().int().nonnegative(),
});

const SignedScalarOutputDataSchema = z.object({
	Value: z.number().int(),
});

const RotateWithDirectionOutputDataSchema = z.object({
	Value: z.number().int().nonnegative(),
	Clockwise: z.boolean(),
});

const HwPositionOutputDataSchema = z.object({
	Position: z.number().int().nonnegative(),
	Duration: z.number().int().nonnegative(),
});

export const OutputCommandSchema = z.union([
	z.strictObject({ Vibrate: UnsignedScalarOutputDataSchema }),
	z.strictObject({ Rotate: UnsignedScalarOutputDataSchema }),
	z.strictObject({ RotateWithDirection: RotateWithDirectionOutputDataSchema }),
	z.strictObject({ Oscillate: UnsignedScalarOutputDataSchema }),
	z.strictObject({ Constrict: UnsignedScalarOutputDataSchema }),
	z.strictObject({ Spray: UnsignedScalarOutputDataSchema }),
	z.strictObject({ Temperature: SignedScalarOutputDataSchema }),
	z.strictObject({ Led: UnsignedScalarOutputDataSchema }),
	z.strictObject({ Position: UnsignedScalarOutputDataSchema }),
	z.strictObject({ HwPositionWithDuration: HwPositionOutputDataSchema }),
]);

export type OutputCommand = z.infer<typeof OutputCommandSchema>;

export const OutputCmdSchema = BaseMessageSchema.extend({
	DeviceIndex: z.number().int(),
	FeatureIndex: z.number().int(),
	Command: OutputCommandSchema,
});

export type OutputCmd = z.infer<typeof OutputCmdSchema>;

import { z } from "zod";

import { MAX_MESSAGE_ID } from "../constants";

export const OUTPUT_TYPE_VALUES = [
	"Vibrate",
	"Rotate",
	"RotateWithDirection",
	"Oscillate",
	"Constrict",
	"Spray",
	"Temperature",
	"Led",
	"Position",
	"HwPositionWithDuration",
] as const;

export const OutputTypeSchema = z.enum(OUTPUT_TYPE_VALUES);

export type OutputType = z.infer<typeof OutputTypeSchema>;

export const INPUT_TYPE_VALUES = ["Battery", "RSSI", "Pressure", "Button", "Position"] as const;

export const InputTypeSchema = z.enum(INPUT_TYPE_VALUES);

export type InputType = z.infer<typeof InputTypeSchema>;

export const InputCommandTypeSchema = z.enum(["Read", "Subscribe", "Unsubscribe"]);

export type InputCommandType = z.infer<typeof InputCommandTypeSchema>;

export const BaseMessageSchema = z.object({
	Id: z.number().int().min(0).max(MAX_MESSAGE_ID),
});

export type BaseMessage = z.infer<typeof BaseMessageSchema>;

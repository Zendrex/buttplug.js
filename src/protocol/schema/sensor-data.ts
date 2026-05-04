import { z } from "zod";

import { BaseMessageSchema } from "./primitives";

const SensorValueSchema = z.object({ Value: z.number().int() });

export type SensorValue = z.infer<typeof SensorValueSchema>;

const InputDataSchema = z.union([
	z.strictObject({ Battery: SensorValueSchema }),
	z.strictObject({ RSSI: SensorValueSchema }),
	z.strictObject({ Pressure: SensorValueSchema }),
	z.strictObject({ Button: SensorValueSchema }),
	z.strictObject({ Position: SensorValueSchema }),
]);

export type InputData = z.infer<typeof InputDataSchema>;

export const InputReadingSchema = BaseMessageSchema.extend({
	DeviceIndex: z.number().int(),
	FeatureIndex: z.number().int(),
	Reading: InputDataSchema,
});

export type InputReading = z.infer<typeof InputReadingSchema>;

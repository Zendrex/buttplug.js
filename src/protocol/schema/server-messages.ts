import { z } from "zod";

import { ErrorCode } from "../../lib/errors";
import { BaseMessageSchema } from "./primitives";
import { DeviceListSchema } from "./raw-device";
import { InputReadingSchema } from "./sensor-data";

const ServerInfoSchema = BaseMessageSchema.extend({
	ServerName: z.string().nullish(),
	ProtocolVersionMajor: z.number().int(),
	ProtocolVersionMinor: z.number().int(),
	MaxPingTime: z.number().int(),
});

export type ServerInfo = z.infer<typeof ServerInfoSchema>;

const OkSchema = BaseMessageSchema;

export type Ok = z.infer<typeof OkSchema>;

const ErrorMsgSchema = BaseMessageSchema.extend({
	ErrorCode: z.nativeEnum(ErrorCode),
	ErrorMessage: z.string(),
});

export type ErrorMsg = z.infer<typeof ErrorMsgSchema>;

const ScanningFinishedSchema = BaseMessageSchema;

export type ScanningFinished = z.infer<typeof ScanningFinishedSchema>;

export const ServerMessageSchema = z.union([
	z.strictObject({ ServerInfo: ServerInfoSchema }),
	z.strictObject({ Ok: OkSchema }),
	z.strictObject({ Error: ErrorMsgSchema }),
	z.strictObject({ DeviceList: DeviceListSchema }),
	z.strictObject({ ScanningFinished: ScanningFinishedSchema }),
	z.strictObject({ InputReading: InputReadingSchema }),
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;

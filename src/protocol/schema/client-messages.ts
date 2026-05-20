import { z } from "zod";

import { OutputCmdSchema } from "./output-commands";
import { BaseMessageSchema, InputCommandTypeSchema, InputTypeSchema } from "./primitives";

const RequestServerInfoSchema = BaseMessageSchema.extend({
	ClientName: z.string().min(1),
	ProtocolVersionMajor: z.number().int(),
	ProtocolVersionMinor: z.number().int(),
});

export type RequestServerInfo = z.infer<typeof RequestServerInfoSchema>;

const StartScanningSchema = BaseMessageSchema;

export type StartScanning = z.infer<typeof StartScanningSchema>;

const StopScanningSchema = BaseMessageSchema;

export type StopScanning = z.infer<typeof StopScanningSchema>;

const RequestDeviceListSchema = BaseMessageSchema;

export type RequestDeviceList = z.infer<typeof RequestDeviceListSchema>;

const PingSchema = BaseMessageSchema;

export type Ping = z.infer<typeof PingSchema>;

const DisconnectSchema = BaseMessageSchema;

export type Disconnect = z.infer<typeof DisconnectSchema>;

const StopCmdSchema = BaseMessageSchema.extend({
	DeviceIndex: z.number().int().optional(),
	FeatureIndex: z.number().int().optional(),
	Inputs: z.boolean().optional(),
	Outputs: z.boolean().optional(),
});

export type StopCmd = z.infer<typeof StopCmdSchema>;

const InputCmdSchema = BaseMessageSchema.extend({
	DeviceIndex: z.number().int(),
	FeatureIndex: z.number().int(),
	Type: InputTypeSchema,
	Command: InputCommandTypeSchema,
});

export type InputCmd = z.infer<typeof InputCmdSchema>;

const ClientMessageSchema = z.union([
	z.strictObject({ RequestServerInfo: RequestServerInfoSchema }),
	z.strictObject({ StartScanning: StartScanningSchema }),
	z.strictObject({ StopScanning: StopScanningSchema }),
	z.strictObject({ RequestDeviceList: RequestDeviceListSchema }),
	z.strictObject({ Ping: PingSchema }),
	z.strictObject({ Disconnect: DisconnectSchema }),
	z.strictObject({ StopCmd: StopCmdSchema }),
	z.strictObject({ OutputCmd: OutputCmdSchema }),
	z.strictObject({ InputCmd: InputCmdSchema }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

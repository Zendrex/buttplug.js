import { z } from "zod";

import { ErrorCode } from "../lib/errors";
import { MAX_MESSAGE_ID } from "./constants";

// ============================================================================
// Enums & Primitives
// ============================================================================

/** Supported output actuator types in the Buttplug v4 protocol. */
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

/** Supported input sensor types in the Buttplug v4 protocol. */
export const INPUT_TYPE_VALUES = ["Battery", "RSSI", "Pressure", "Button", "Position"] as const;

export const InputTypeSchema = z.enum(INPUT_TYPE_VALUES);
export type InputType = z.infer<typeof InputTypeSchema>;

export const InputCommandTypeSchema = z.enum(["Read", "Subscribe", "Unsubscribe"]);

/** Input command operation: one-shot read, subscribe for updates, or unsubscribe. */
export type InputCommandType = z.infer<typeof InputCommandTypeSchema>;

// ============================================================================
// Base Message
// ============================================================================

/**
 * Base message fields shared by all Buttplug protocol messages.
 *
 * Every message includes an `Id` field for request/response correlation,
 * constrained to a 32-bit unsigned integer range.
 */
export const BaseMessageSchema = z.object({
	Id: z.number().int().min(0).max(MAX_MESSAGE_ID),
});

export type BaseMessage = z.infer<typeof BaseMessageSchema>;

// ============================================================================
// Client Messages
// ============================================================================

/**
 * Handshake request schema to identify the client and negotiate protocol version.
 */
export const RequestServerInfoSchema = BaseMessageSchema.extend({
	ClientName: z.string().min(1),
	ProtocolVersionMajor: z.number().int(),
	ProtocolVersionMinor: z.number().int(),
});

export type RequestServerInfo = z.infer<typeof RequestServerInfoSchema>;

/** Request to begin scanning for devices. */
export const StartScanningSchema = BaseMessageSchema;
export type StartScanning = z.infer<typeof StartScanningSchema>;

/** Request to stop an ongoing device scan. */
export const StopScanningSchema = BaseMessageSchema;
export type StopScanning = z.infer<typeof StopScanningSchema>;

/** Request the current list of connected devices. */
export const RequestDeviceListSchema = BaseMessageSchema;
export type RequestDeviceList = z.infer<typeof RequestDeviceListSchema>;

/** Keep-alive ping message to maintain the connection. */
export const PingSchema = BaseMessageSchema;
export type Ping = z.infer<typeof PingSchema>;

/** Request to gracefully disconnect from the server. */
export const DisconnectSchema = BaseMessageSchema;
export type Disconnect = z.infer<typeof DisconnectSchema>;

/**
 * Stop command schema with optional targeting.
 *
 * Omitting all optional fields stops all activity on all devices.
 */
export const StopCmdSchema = BaseMessageSchema.extend({
	DeviceIndex: z.number().int().optional(),
	FeatureIndex: z.number().int().optional(),
	Inputs: z.boolean().optional(),
	Outputs: z.boolean().optional(),
});

export type StopCmd = z.infer<typeof StopCmdSchema>;

// ============================================================================
// Output Command Data
// ============================================================================

/**
 * Unsigned scalar output command data wrapped in a `{Value}` object.
 *
 * Intiface Central expects `{"Vibrate": {"Value": 15}}`, not bare integers.
 */
export const UnsignedScalarOutputDataSchema = z.object({
	Value: z.number().int().nonnegative(),
});

export type UnsignedScalarOutputData = z.infer<typeof UnsignedScalarOutputDataSchema>;

/**
 * Signed scalar output command data wrapped in a `{Value}` object.
 *
 * Used by Temperature (positive = heat, negative = cool).
 */
export const SignedScalarOutputDataSchema = z.object({
	Value: z.number().int(),
});

export type SignedScalarOutputData = z.infer<typeof SignedScalarOutputDataSchema>;

/** Alias for {@link UnsignedScalarOutputData}, used by most output types. */
export type ScalarOutputData = UnsignedScalarOutputData;

/** Rotation output with explicit direction control. */
export const RotateWithDirectionOutputDataSchema = z.object({
	Value: z.number().int().nonnegative(),
	Clockwise: z.boolean(),
});

export type RotateWithDirectionOutputData = z.infer<typeof RotateWithDirectionOutputDataSchema>;

/**
 * Hardware position output with duration for timed movements.
 *
 * Spec section: HwPositionWithDuration uses `Position` (not `Value`) and `Duration`.
 */
export const HwPositionOutputDataSchema = z.object({
	Position: z.number().int().nonnegative(),
	Duration: z.number().int().nonnegative(),
});

export type HwPositionOutputData = z.infer<typeof HwPositionOutputDataSchema>;

/**
 * Tagged output command union discriminated by actuator type key.
 *
 * Each variant is a single-key object mapping the output type name to its data shape.
 */
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

/** Client message to send an output command to a specific device feature. */
export const OutputCmdSchema = BaseMessageSchema.extend({
	DeviceIndex: z.number().int(),
	FeatureIndex: z.number().int(),
	Command: OutputCommandSchema,
});

export type OutputCmd = z.infer<typeof OutputCmdSchema>;

// ============================================================================
// Input Commands
// ============================================================================

/** Client message to read from or subscribe to a device sensor. */
export const InputCmdSchema = BaseMessageSchema.extend({
	DeviceIndex: z.number().int(),
	FeatureIndex: z.number().int(),
	Type: InputTypeSchema,
	Command: InputCommandTypeSchema,
});

export type InputCmd = z.infer<typeof InputCmdSchema>;

// ============================================================================
// Client Message Union
// ============================================================================

/**
 * Tagged union of all client messages.
 *
 * Each variant is a single-key object wrapping the specific message schema.
 */
export const ClientMessageSchema = z.union([
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

// ============================================================================
// Server Messages
// ============================================================================

/** Handshake response from the server with capabilities and timing requirements. */
export const ServerInfoSchema = BaseMessageSchema.extend({
	ServerName: z.string().nullish(),
	ProtocolVersionMajor: z.number().int(),
	ProtocolVersionMinor: z.number().int(),
	MaxPingTime: z.number().int(),
});

export type ServerInfo = z.infer<typeof ServerInfoSchema>;

/** Success response acknowledging a client request. */
export const OkSchema = BaseMessageSchema;
export type Ok = z.infer<typeof OkSchema>;

/** Error response with code and human-readable message. */
export const ErrorMsgSchema = BaseMessageSchema.extend({
	ErrorCode: z.nativeEnum(ErrorCode),
	ErrorMessage: z.string(),
});

export type ErrorMsg = z.infer<typeof ErrorMsgSchema>;

// ============================================================================
// Sensor / Input Data
// ============================================================================

/**
 * Sensor reading value from a device.
 *
 * Intiface Central wraps sensor values in a `{Value}` object,
 * e.g. `{"Battery": {"Value": 90}}`.
 */
export const SensorValueSchema = z.object({ Value: z.number().int() });

export type SensorValue = z.infer<typeof SensorValueSchema>;

/**
 * Tagged sensor data union discriminated by sensor type key.
 *
 * Each variant maps a sensor type name to its {@link SensorValue}.
 */
export const InputDataSchema = z.union([
	z.strictObject({ Battery: SensorValueSchema }),
	z.strictObject({ RSSI: SensorValueSchema }),
	z.strictObject({ Pressure: SensorValueSchema }),
	z.strictObject({ Button: SensorValueSchema }),
	z.strictObject({ Position: SensorValueSchema }),
]);

export type InputData = z.infer<typeof InputDataSchema>;

/** Server message delivering a sensor reading from a device. */
export const InputReadingSchema = BaseMessageSchema.extend({
	DeviceIndex: z.number().int(),
	FeatureIndex: z.number().int(),
	Reading: InputDataSchema,
});

export type InputReading = z.infer<typeof InputReadingSchema>;

// ============================================================================
// Raw Device Descriptors
// ============================================================================

/**
 * Raw output capability descriptor with value range and optional duration range.
 *
 * Value range is not constrained to non-negative because Temperature uses signed
 * integers (positive = heat, negative = cool). Non-negative validation for unsigned
 * output types is enforced at the feature parsing layer instead.
 */
export const RawFeatureOutputSchema = z.object({
	Value: z.tuple([z.number().int(), z.number().int()]),
	Duration: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]).optional(),
});

export type RawFeatureOutput = z.infer<typeof RawFeatureOutputSchema>;

/**
 * Raw input capability descriptor with supported commands and value range.
 *
 * Intiface Central sends `Value` as an array of `[min, max]` tuples,
 * e.g. `[[0, 100]]`, even though typically only one range is present.
 */
export const RawFeatureInputSchema = z.object({
	Command: z.array(InputCommandTypeSchema),
	Value: z.array(z.tuple([z.number().int(), z.number().int()])),
});

export type RawFeatureInput = z.infer<typeof RawFeatureInputSchema>;

export const RawDeviceFeatureSchema = z.object({
	FeatureIndex: z.number().int(),
	FeatureDescription: z.string(),
	Output: z.record(z.string(), RawFeatureOutputSchema).nullish(),
	Input: z.record(z.string(), RawFeatureInputSchema).nullish(),
});

/** Raw device feature descriptor as reported by the server, before normalization. */
export type RawDeviceFeature = z.infer<typeof RawDeviceFeatureSchema>;

/** Raw device descriptor as reported by the server, before normalization. */
export const RawDeviceSchema = z.object({
	DeviceName: z.string(),
	DeviceIndex: z.number().int(),
	DeviceMessageTimingGap: z.number().int(),
	DeviceDisplayName: z.string().nullish(),
	DeviceFeatures: z.record(z.string(), RawDeviceFeatureSchema),
});

export type RawDevice = z.infer<typeof RawDeviceSchema>;

/** Server message containing all currently connected devices. */
export const DeviceListSchema = BaseMessageSchema.extend({
	Devices: z.record(z.string(), RawDeviceSchema),
});

export type DeviceList = z.infer<typeof DeviceListSchema>;

/** Server notification that device scanning has completed. */
export const ScanningFinishedSchema = BaseMessageSchema;
export type ScanningFinished = z.infer<typeof ScanningFinishedSchema>;

// ============================================================================
// Server Message Union
// ============================================================================

/**
 * Tagged union of all server messages.
 *
 * Each variant is a single-key object wrapping the specific message schema.
 */
export const ServerMessageSchema = z.union([
	z.strictObject({ ServerInfo: ServerInfoSchema }),
	z.strictObject({ Ok: OkSchema }),
	z.strictObject({ Error: ErrorMsgSchema }),
	z.strictObject({ DeviceList: DeviceListSchema }),
	z.strictObject({ ScanningFinished: ScanningFinishedSchema }),
	z.strictObject({ InputReading: InputReadingSchema }),
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;

// ============================================================================
// Normalized Feature Descriptors
// ============================================================================

/** Normalized output feature descriptor with type, index, and capabilities. */
export const OutputFeatureSchema = z.object({
	type: OutputTypeSchema,
	index: z.number().int(),
	description: z.string(),
	range: z.tuple([z.number().int(), z.number().int()]),
	durationRange: z.tuple([z.number().int(), z.number().int()]).optional(),
});

export type OutputFeature = z.infer<typeof OutputFeatureSchema>;

/**
 * Normalized input feature descriptor with type, index, and command capabilities.
 *
 * Spec section: Input Capability Object — Value is a single `[min, max]` range.
 */
export const InputFeatureSchema = z.object({
	type: InputTypeSchema,
	index: z.number().int(),
	description: z.string(),
	range: z.tuple([z.number().int(), z.number().int()]),
	canRead: z.boolean(),
	canSubscribe: z.boolean(),
});

export type InputFeature = z.infer<typeof InputFeatureSchema>;

/** Collection of normalized input and output features for a device. */
export const DeviceFeaturesSchema = z.object({
	outputs: z.array(OutputFeatureSchema),
	inputs: z.array(InputFeatureSchema),
});

export type DeviceFeatures = z.infer<typeof DeviceFeaturesSchema>;

// ============================================================================
// Feature Value Types
// ============================================================================

export const FeatureValueSchema = z.object({
	index: z.number().int(),
	value: z.number().int(),
});

/** Feature index paired with a scalar value, used for batch output commands. */
export type FeatureValue = z.infer<typeof FeatureValueSchema>;

/** Feature index paired with speed and direction for rotation commands. */
export const RotationValueSchema = z.object({
	index: z.number().int(),
	speed: z.number().int(),
	clockwise: z.boolean(),
});

export type RotationValue = z.infer<typeof RotationValueSchema>;

/** Feature index paired with position and duration for timed movement commands. */
export const PositionValueSchema = z.object({
	index: z.number().int(),
	position: z.number().int(),
	duration: z.number().int(),
});

export type PositionValue = z.infer<typeof PositionValueSchema>;

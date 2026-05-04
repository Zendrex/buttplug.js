export { ButtplugClient } from "./client";
export { Device } from "./device";
export {
	ButtplugError,
	ConnectionError,
	DeviceError,
	ErrorCode,
	formatError,
	HandshakeError,
	ProtocolError,
	TimeoutError,
} from "./lib/errors";
export {
	consoleLogger,
	noopLogger,
	resolveDiagnosticsLogger,
} from "./lib/logger";
export { INPUT_TYPES, OUTPUT_TYPES } from "./protocol/features";
export type {
	ButtplugClientOptions,
	ClientEventMap,
} from "./client";
export type { DeviceOutputOptions, DeviceStopOptions } from "./device";
export type {
	Logger,
	ResolveDiagnosticsLoggerOptions,
} from "./lib/logger";
export type {
	ClientMessage,
	DeviceFeatures,
	FeatureValue,
	InputData,
	InputFeature,
	InputReading,
	InputType,
	OutputCommand,
	OutputFeature,
	OutputType,
	PositionValue,
	RawDevice,
	RotationValue,
	SensorValue,
	ServerInfo,
	ServerMessage,
} from "./protocol/schema";
export type { SensorCallback } from "./protocol/types";

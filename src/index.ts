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
export { EASING_FUNCTIONS, EASING_VALUES } from "./patterns/easing";
export { PatternEngine } from "./patterns/engine";
export { getPresetInfo, PRESET_NAMES, PRESETS } from "./patterns/presets";
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
export type { Easing, Keyframe } from "./patterns/easing";
export type { PatternDescriptor } from "./patterns/engine";
export type { PresetInfo, PresetName, PresetPattern } from "./patterns/presets";
export type { CustomPattern, Track } from "./patterns/track-resolver";
export type {
	PatternDevice,
	PatternEngineClient,
	PatternInfo,
	PatternPlayOptions,
	StopReason,
} from "./patterns/types";
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

/**
 * @packageDocumentation
 *
 * Buttplug.js client library for controlling intimate hardware over WebSocket.
 *
 * This package provides:
 * - {@link ButtplugClient} - High-level client with connection, scanning, and device management
 * - {@link Device} - Per-device control for outputs (vibration, rotation, position) and sensor input
 * - {@link PatternEngine} - Keyframe-based pattern playback engine
 *
 * Also re-exports protocol types, schemas, transport classes, and utility errors
 * from internal packages for consumer convenience.
 */

/** biome-ignore-all lint/performance/noBarrelFile: package entry point re-exports public API */
/** biome-ignore-all assist/source/organizeImports: exports grouped by source package */

// Main classes
export { ButtplugClient } from "./client";
export { Device } from "./device";

// Client types
export type {
	ButtplugClientOptions,
	ClientEventMap,
	DeviceOptions,
	DeviceOutputOptions,
	DeviceStopOptions,
} from "./types";

// Re-exports from lib/
export type { TypedEmitter } from "./lib/emitter";
export type { Logger } from "./lib/logger";
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
export { consoleLogger, noopLogger } from "./lib/logger";
export { getLogger, runWithLogger } from "./lib/context";

// Re-exports from protocol/
export type {
	ClientMessage,
	DeviceFeatures,
	FeatureValue,
	HwPositionOutputData,
	InputCommandType,
	InputData,
	InputFeature,
	InputReading,
	InputType,
	OutputCommand,
	OutputFeature,
	OutputType,
	PositionValue,
	RotateWithDirectionOutputData,
	RotationValue,
	ScalarOutputData,
	SensorValue,
	ServerInfo,
	ServerMessage,
	SignedScalarOutputData,
	UnsignedScalarOutputData,
} from "./protocol/schema";
export type { DeviceMessageSender, SensorCallback } from "./protocol/types";
export {
	ClientMessageSchema,
	DeviceFeaturesSchema,
	FeatureValueSchema,
	HwPositionOutputDataSchema,
	INPUT_TYPE_VALUES,
	InputCommandTypeSchema,
	InputDataSchema,
	InputFeatureSchema,
	InputReadingSchema,
	InputTypeSchema,
	OUTPUT_TYPE_VALUES,
	OutputCommandSchema,
	OutputFeatureSchema,
	OutputTypeSchema,
	PositionValueSchema,
	RotateWithDirectionOutputDataSchema,
	RotationValueSchema,
	SensorValueSchema,
	ServerInfoSchema,
	ServerMessageSchema,
	SignedScalarOutputDataSchema,
	UnsignedScalarOutputDataSchema,
} from "./protocol/schema";
export {
	DEFAULT_CLIENT_NAME,
	DEFAULT_PING_INTERVAL,
	DEFAULT_REQUEST_TIMEOUT,
	MAX_MESSAGE_ID,
	PROTOCOL_VERSION_MAJOR,
	PROTOCOL_VERSION_MINOR,
} from "./protocol/constants";

// Re-exports from transport/
export type {
	Transport,
	TransportEvents,
	TransportOptions,
	TransportState,
} from "./transport/types";
export type { PingOptions } from "./transport/ping";
export type { ReconnectOptions } from "./transport/reconnect";
export type { WebSocketTransportOptions } from "./transport/connection";
export { PingManager } from "./transport/ping";
export { ReconnectDefaults } from "./transport/constants";
export { ReconnectHandler } from "./transport/reconnect";
export { WebSocketTransport } from "./transport/connection";

// Re-exports from builders/
export { INPUT_TYPES, OUTPUT_TYPES } from "./builders/features";

// Re-exports from patterns/
export type { EasingFunction, EasingName } from "./patterns/easing";
export type {
	CustomPattern,
	Easing,
	Keyframe,
	PatternDescriptor,
	PatternDevice,
	PatternEngineClient,
	PatternInfo,
	PatternPlayOptions,
	PlayOptions,
	PresetInfo,
	PresetName,
	PresetPattern,
	StopReason,
	Track,
} from "./patterns/types";
export { EASING_FUNCTIONS } from "./patterns/easing";
export {
	EASING_VALUES,
	KeyframeSchema,
	PatternDescriptorSchema,
	PRESET_NAMES,
} from "./patterns/types";
export { PatternEngine } from "./patterns/engine";
export { PRESETS, getPresetInfo } from "./patterns/presets";

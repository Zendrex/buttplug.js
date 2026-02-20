/**
 * @packageDocumentation
 *
 * Buttplug.js client library for controlling intimate hardware over WebSocket.
 *
 * This package provides:
 * - {@link ButtplugClient} - High-level client with connection, scanning, and device management
 * - {@link Device} - Per-device control for outputs (vibration, rotation, position) and sensor input
 * - {@link PatternEngine} - Keyframe-based pattern playback engine
 */

/** biome-ignore-all lint/performance/noBarrelFile: package entry point re-exports public API */
/** biome-ignore-all assist/source/organizeImports: exports grouped by domain */

// Main classes
export { ButtplugClient } from "./client";
export { Device } from "./device";

// Client types
export type {
	ButtplugClientOptions,
	ClientEventMap,
	DeviceOutputOptions,
	DeviceStopOptions,
} from "./types";

// Errors
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

// Logger
export type { Logger } from "./lib/logger";
export { consoleLogger, noopLogger } from "./lib/logger";

// Protocol types (used in public method signatures and event payloads)
export type {
	ClientMessage,
	DeviceFeatures,
	FeatureValue,
	InputFeature,
	InputReading,
	InputType,
	OutputCommand,
	OutputFeature,
	OutputType,
	PositionValue,
	RotationValue,
	ServerInfo,
	ServerMessage,
} from "./protocol/schema";
export type { SensorCallback } from "./protocol/types";

// Feature type constants
export { INPUT_TYPES, OUTPUT_TYPES } from "./builders/features";

// Pattern engine
export { PatternEngine } from "./patterns/engine";
export type {
	CustomPattern,
	Easing,
	Keyframe,
	PatternDescriptor,
	PatternDevice,
	PatternEngineClient,
	PatternInfo,
	PatternPlayOptions,
	PresetInfo,
	PresetName,
	PresetPattern,
	StopReason,
	Track,
} from "./patterns/types";
export { EASING_VALUES, PRESET_NAMES } from "./patterns/types";
export { EASING_FUNCTIONS } from "./patterns/easing";
export { PRESETS, getPresetInfo } from "./patterns/presets";

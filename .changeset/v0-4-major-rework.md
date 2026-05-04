---
"@zendrex/buttplug.js": major
---

Restructured the public API and internal module layout for v0.4.

**Breaking changes**

- `ButtplugClientOptions` and `ClientEventMap` are now exported from the main entrypoint via `./client` (previously `./types`). Consumers importing from `@zendrex/buttplug.js` are unaffected; deep imports must update.
- `INPUT_TYPES` and `OUTPUT_TYPES` moved from `./builders/features` to `./protocol/features`.
- The protocol schema module is now a directory (`./protocol/schema/`) split into focused files (`client-messages`, `server-messages`, `output-commands`, `features`, `sensor-data`, `raw-device`, `primitives`, `values`). The barrel export at `./protocol/schema` is preserved.
- `./patterns/types` no longer re-exports easing or preset values. Import `EASING_VALUES` / `EASING_FUNCTIONS` / `Easing` / `Keyframe` from `./patterns/easing`, and `PRESET_NAMES` / `PRESETS` / `getPresetInfo` / `PresetInfo` / `PresetName` / `PresetPattern` from `./patterns/presets`.
- `PatternDescriptor` is now exported from `./patterns/engine`; `CustomPattern` and `Track` from `./patterns/track-resolver`.
- The builder layer was split: `./builders/commands`, `./builders/features`, and `./builders/validation` were removed in favor of per-actuator modules (`./builders/scalar`, `./builders/rotation`, `./builders/position`, `./builders/shared`).
- Removed `./types`, `./core/types`, and `./core/utils` (their exports were folded into the modules that own them; promise helpers now live in `./lib/promise`).

**New**

- `resolveDiagnosticsLogger` and `ResolveDiagnosticsLoggerOptions` exported from the main entrypoint.
- `RawDevice`, `SensorValue`, and `InputData` types exported from the main entrypoint.
- New `./lib/range.ts` and `./lib/promise.ts` utilities.

**Other**

- Updated `zod` to `^4.4.3`, `@biomejs/biome` to `2.4.14`, and other dev dependencies.

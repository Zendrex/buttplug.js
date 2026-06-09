---
"@zendrex/buttplug.js": minor
---

Naming cleanup for clarity and role-consistent prefixes. Several exports and options were renamed; update imports and call sites accordingly.

**Patterns (`@zendrex/buttplug.js/patterns`):**
- `PatternEngineClient` → `PatternClient`
- `getPresetInfo` → `listPresets` (module export; `PatternEngine.listPresets()` unchanged in name)
- `PresetInfo.compatibleOutputTypes` → `outputTypes`
- `PatternEngine.play(device, …)` → `play(target, …)` (parameter rename only)

**Sensors (`DeviceMessageSender` / custom client implementors):**
- `registerSensorSubscription` → `registerSensor`
- `unregisterSensorSubscription` → `unregisterSensor`

**Feature helpers (deep imports from `./protocol/features`):**
- `getOutputsByType` → `outputsByType`
- `getInputsByType` → `inputsByType`

**Wasm transport (`@zendrex/buttplug.js/wasm`):**
- `WasmTransportOptions.enableWasmLogging` → `enableLogging`
- `WasmTransportOptions.wasmLogLevel` → `logLevel`

**Unchanged (intentionally kept):** `ButtplugClientOptions.clientName`, `requestTimeout`; device `featureIndex` options; `Device` class name.

# @zendrex/buttplug.js

## 0.4.0

### Minor Changes

- [#36](https://github.com/Zendrex/buttplug.js/pull/36) [`4aef7c7`](https://github.com/Zendrex/buttplug.js/commit/4aef7c7dd097629ffac1d2be218bbf532ee72f72) Thanks [@Zendrex](https://github.com/Zendrex)! - **Breaking:** All device output methods now accept **normalized 0–1 floats** instead of device-range integers. The library maps each 0–1 value to the feature's server-reported device range internally, so `0.5` always means "midpoint" regardless of whether the device exposes a 0–100, 0–20, or any other range.

  Affected methods on `Device`:

  - `vibrate(intensity)`
  - `oscillate(speed)`
  - `constrict(value)`
  - `spray(value)`
  - `temperature(value)`
  - `led(value)`
  - `rotate(speed, options?)`
  - `position(position, options?)`

  The per-feature `FeatureValue.value`, `RotationValue.speed`, and `PositionValue.position` fields are now `0–1` floats (the zod schemas enforce the range).

  **Migration:** divide previous device-range integers by the feature range maximum (typically `100`):

  ```diff
  - await device.vibrate(50);
  + await device.vibrate(0.5);

  - await device.rotate(75, { clockwise: false });
  + await device.rotate(0.75, { clockwise: false });

  - await device.position(80, { duration: 500 });
  + await device.position(0.8, { duration: 500 });

  - await device.vibrate([{ index: 0, value: 80 }]);
  + await device.vibrate([{ index: 0, value: 0.8 }]);
  ```

  `PatternEngine` already used 0–1 intensities and keyframe values, so its API is unchanged — the device API now matches it.

  **Escape hatch unchanged:** `Device.output()` is the raw protocol passthrough and still takes device-range integers (`{ Vibrate: { Value: 50 } }`), since it sends literal `OutputCmd` payloads. Use it only when you specifically need raw protocol values.

  **Why:** devices report varying step counts. Normalized 0–1 means a single semantic input ("half intensity") works across all hardware, with precision-preserving rounding done once at the protocol boundary instead of twice. It also matches the pattern engine's existing 0–1 scale and standard web platform conventions (gain, opacity, color channels).

- [#36](https://github.com/Zendrex/buttplug.js/pull/36) [`f7b8156`](https://github.com/Zendrex/buttplug.js/commit/f7b81564c49f81ee2c0fa55660cdaa653f68ca0e) Thanks [@Zendrex](https://github.com/Zendrex)! - Restructured the public API and internal module layout for v0.4.

  **Breaking changes**

  - Pattern APIs moved to the `@zendrex/buttplug.js/patterns` subpath export. The pattern engine is now a drop-in feature, separated from the core client surface.
    - `PatternEngine`, `EASING_FUNCTIONS`, `EASING_VALUES`, `PRESET_NAMES`, `PRESETS`, `getPresetInfo` are no longer re-exported from the package root.
    - Pattern types (`PatternDescriptor`, `PatternDevice`, `PatternEngineClient`, `PatternInfo`, `PatternPlayOptions`, `PresetInfo`, `PresetName`, `PresetPattern`, `CustomPattern`, `Track`, `Keyframe`, `Easing`, `StopReason`) are no longer re-exported from the package root.
  - `ButtplugClientOptions` and `ClientEventMap` are now exported from the main entrypoint via `./client` (previously `./types`). Consumers importing from `@zendrex/buttplug.js` are unaffected; deep imports must update.
  - `INPUT_TYPES` and `OUTPUT_TYPES` moved from `./builders/features` to `./protocol/features`.
  - The protocol schema module is now a directory (`./protocol/schema/`) split into focused files (`client-messages`, `server-messages`, `output-commands`, `features`, `sensor-data`, `raw-device`, `primitives`, `values`). The barrel export at `./protocol/schema` is preserved.
  - Within the patterns subpath: `./patterns/types` no longer re-exports easing or preset values. Import `EASING_VALUES` / `EASING_FUNCTIONS` / `Easing` / `Keyframe` from `./patterns/easing`, and `PRESET_NAMES` / `PRESETS` / `getPresetInfo` / `PresetInfo` / `PresetName` / `PresetPattern` from `./patterns/presets`. `PatternDescriptor` is now exported from `./patterns/engine`; `CustomPattern` and `Track` from `./patterns/track-resolver`.
  - The builder layer was split: `./builders/commands`, `./builders/features`, and `./builders/validation` were removed in favor of per-actuator modules (`./builders/scalar`, `./builders/rotation`, `./builders/position`, `./builders/shared`).
  - Removed `./types`, `./core/types`, and `./core/utils` (their exports were folded into the modules that own them; promise helpers now live in `./lib/promise`).

  **Migration**

  ```ts
  // Before
  import { ButtplugClient, PatternEngine } from "@zendrex/buttplug.js";

  // After
  import { ButtplugClient } from "@zendrex/buttplug.js";
  import { PatternEngine } from "@zendrex/buttplug.js/patterns";
  ```

  **New**

  - `resolveDiagnosticsLogger` and `ResolveDiagnosticsLoggerOptions` exported from the main entrypoint.
  - `RawDevice`, `SensorValue`, and `InputData` types exported from the main entrypoint.
  - New `./lib/range.ts` and `./lib/promise.ts` utilities.

  **Other**

  - Updated `zod` to `^4.4.3`, `@biomejs/biome` to `2.4.14`, and other dev dependencies.

- [#36](https://github.com/Zendrex/buttplug.js/pull/36) [`b281003`](https://github.com/Zendrex/buttplug.js/commit/b281003c392a86b6b5e0c0bf31790354cbc231ed) Thanks [@Zendrex](https://github.com/Zendrex)! - Added `WasmTransport` for running the Buttplug server in-browser via `buttplug-wasm-blob` — no Intiface Central required. Exposed from the new `@zendrex/buttplug.js/wasm` subpath; `buttplug-wasm-blob` is an optional peer dependency. Requires a Chromium-family browser served over HTTPS (Web Bluetooth).

  `ButtplugClient` now accepts either a WebSocket URL string or an injected `Transport` instance, so custom transports can be plugged in:

  ```ts
  import { ButtplugClient } from "@zendrex/buttplug.js";
  import { WasmTransport } from "@zendrex/buttplug.js/wasm";

  const client = new ButtplugClient(new WasmTransport());
  await client.connect();
  ```

  The string-URL constructor (`new ButtplugClient("ws://...")`) remains unchanged.

  Also exported the `Transport` interface, `TransportEvents`, `TransportState`, `TransportEventName`, `WebSocketTransport`, and `WebSocketTransportOptions` from the package root for custom transport authors.

  **Internal refactor (non-breaking for string-URL users):** `Transport.connect()` no longer takes a URL argument — `WebSocketTransport` now receives its URL via constructor (`new WebSocketTransport(url, options?)`). Direct users of `WebSocketTransport` will need to move the URL from `connect()` to the constructor.

## 0.3.3

### Patch Changes

- [#26](https://github.com/Zendrex/buttplug.js/pull/26) [`6c002fc`](https://github.com/Zendrex/buttplug.js/commit/6c002fcab16cbcc5976e2c5d9a20e297d4f99eb2) Thanks [@Zendrex](https://github.com/Zendrex)! - Fixed Proxy compatibility for all classes by replacing JS `#private` fields with TypeScript `private` keyword fields. Wrapping instances (e.g. `Device`, `ButtplugClient`) in a `Proxy` no longer throws `TypeError` when accessing properties or calling methods.

## 0.3.2

### Patch Changes

- [#24](https://github.com/Zendrex/buttplug.js/pull/24) [`4282ada`](https://github.com/Zendrex/buttplug.js/commit/4282adad1b084d581ec288c2e6a715e927f67a20) Thanks [@Zendrex](https://github.com/Zendrex)! - Resolve circular dependency between `device.ts` and `types.ts` by co-locating device option types with the `Device` class.

## 0.3.1

### Patch Changes

- [#22](https://github.com/Zendrex/buttplug.js/pull/22) [`5b97496`](https://github.com/Zendrex/buttplug.js/commit/5b97496b57f891dd37c138a71b2e580334a2c4ab) Thanks [@Zendrex](https://github.com/Zendrex)! - Expose the raw device descriptor via the `Device.raw` getter, providing access to the unprocessed device data from the server.

## 0.3.0

### Minor Changes

- [#19](https://github.com/Zendrex/buttplug.js/pull/19) [`0ea4919`](https://github.com/Zendrex/buttplug.js/commit/0ea4919186b4db0834c0a5c7f3622f1a7afaafe8) Thanks [@Zendrex](https://github.com/Zendrex)! - Remove built-in device message timing gap limit since the interface server already handles dropping commands outside of the device's command window.

  - Removed `messageTimingGap` getter from `Device`
  - Removed `messageTimingGap` from `PatternDevice` interface
  - Pattern engine tick interval defaults to 50ms (20Hz), configurable per-pattern via `tickInterval` in `PatternPlayOptions`

## 0.2.1

### Patch Changes

- [`bb8e36d`](https://github.com/Zendrex/buttplug.js/commit/bb8e36da8accc0c19155a52c095b34488ab9c109) Thanks [@Zendrex](https://github.com/Zendrex)! - Fix event destructuring for emittery v2: update PatternEngine deviceRemoved handler, PatternEngineClient interface types, and all documentation examples to use the `{ data: { ... } }` callback pattern.

## 0.2.0

### Minor Changes

- [`f9ad886`](https://github.com/Zendrex/buttplug.js/commit/f9ad8860e9bfbaec14c89c0cb7a30f5921ecf0c7) Thanks [@Zendrex](https://github.com/Zendrex)! - Migrate build tooling from tsup to tsdown, upgrade emittery to v2 (breaking: event payloads now wrapped in `{ data }`) and typescript to v6, enforce separated type imports via biome, and fix deviceRemoved event destructuring.

## 0.1.1

### Patch Changes

- [#2](https://github.com/Zendrex/buttplug.js/pull/2) [`c08bab2`](https://github.com/Zendrex/buttplug.js/commit/c08bab26f1c1b0207c4149097e99b3653f20dd81) Thanks [@Zendrex](https://github.com/Zendrex)! - version bump

## 0.1.0

### Minor Changes

- [`4be1ead`](https://github.com/Zendrex/buttplug.js/commit/4be1ead759757cd63af4dbe9bb257973e4d70fdc) Thanks [@Zendrex](https://github.com/Zendrex)! - Initial release

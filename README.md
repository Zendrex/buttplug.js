# @zendrex/buttplug.js

Type-safe [Buttplug](https://buttplug.io) v4 client. WebSocket or WASM, Zod-validated.

[Intiface Central](https://intiface.com/central/) or in-browser Web Bluetooth. Discovery, I/O, patterns.

```bash
bun add @zendrex/buttplug.js
```

Works with npm, pnpm, and yarn. Any runtime with WebSocket support (Node 18+, Bun, Deno, browsers). Ships ESM and CJS with `.d.ts` types.

## Overview

- `ButtplugClient`: transport, v4 handshake, scanning, device list, reconnect
- `Device`: capability checks and typed output/sensor methods
- Zod-validated protocol messages (`src/protocol/schema`); types inferred from schemas
- Per-feature output ranges (typically `0`–`100`), clamped to server metadata
- Event-driven lifecycle (`device.*`, `connection.*`, `scan.*`, `input.reading`)
- `PatternEngine` (`@zendrex/buttplug.js/patterns`): presets and custom keyframe tracks

## Prerequisites

| Approach | Typical use | Requirements |
| --- | --- | --- |
| **WebSocket (default)** | Desktop apps, servers, scripts | [Intiface Central](https://intiface.com/central/) on the same machine or network (`ws://127.0.0.1:12345` by default) |
| **WASM transport** | Browser-only, no desktop server | Chromium, HTTPS or `localhost`, optional peer [`buttplug-wasm-blob`](https://www.npmjs.com/package/buttplug-wasm-blob) |

WebSocket mode expects Intiface Central with **Start Server** enabled. Default endpoint: `ws://127.0.0.1:12345` (or `ws://localhost:12345`).

## Quick start

```typescript
import { ButtplugClient } from "@zendrex/buttplug.js";

const client = new ButtplugClient("ws://127.0.0.1:12345");

client.on("device.added", async ({ data: { device } }) => {
  console.log(device.displayName ?? device.name);
  if (device.canOutput("Vibrate")) {
    await device.vibrate(0.5);
    setTimeout(() => device.stop(), 2000);
  }
});

await client.connect();
await client.startScanning();
```


## Examples

### Device discovery

```typescript
client.on("device.added", async ({ data: { device } }) => {
  console.log(`${device.index}: ${device.name}`);
  for (const output of device.features.outputs) {
    console.log(`  ${output.type} (feature ${output.index})`);
  }
});

client.on("device.removed", ({ data: { device } }) => {
  console.log(`gone: ${device.name}`);
});
```

### Outputs

```typescript
await device.vibrate(0.75);
await device.vibrate([
  { index: 0, value: 0.4 },
  { index: 1, value: 1 },
]);

await device.rotate(0.6, { clockwise: false });
await device.position(0.8, { duration: 500 });
await device.stop();
```

All output values are normalized **0–1** floats; the library maps them to each feature's server-reported device range. `canOutput` / `canRead` / `canSubscribe` gate unsupported calls.

### Sensors

```typescript
const level = await device.readSensor("Battery");

const unsub = await device.subscribeSensor("RSSI", (value) => {
  console.log("RSSI", value);
});

await unsub();
```

Pushed sensor updates also arrive on the client as `input.reading`.

### Patterns

`@zendrex/buttplug.js/patterns`

```typescript
import { ButtplugClient } from "@zendrex/buttplug.js";
import { PatternEngine } from "@zendrex/buttplug.js/patterns";

const client = new ButtplugClient("ws://127.0.0.1:12345");
await client.connect();

const engine = new PatternEngine(client);

const id = await engine.play(device, "wave", {
  intensity: 0.8,
  speed: 1.5,
  loop: true,
});

const id2 = await engine.play(device, [
  {
    featureIndex: 0,
    keyframes: [
      { value: 0, duration: 0 },
      { value: 1, duration: 1000, easing: "easeIn" },
      { value: 0.2, duration: 500, easing: "easeOut" },
    ],
  },
], { loop: 3, intensity: 0.6 });

await engine.stop(id);
engine.stopAll();
engine.dispose();
```

Presets: `pulse`, `wave`, `ramp_up`, `ramp_down`, `heartbeat`, `surge`, `stroke`. Easings: `linear`, `easeIn`, `easeOut`, `easeInOut`, `step`.

### WASM (browser, no Intiface)

```bash
bun add @zendrex/buttplug.js buttplug-wasm-blob
```

```typescript
import { ButtplugClient } from "@zendrex/buttplug.js";
import { WasmTransport } from "@zendrex/buttplug.js/wasm";

const client = new ButtplugClient(new WasmTransport());
await client.connect();
await client.startScanning();
```

Chromium over HTTPS or `localhost` only. [WASM guide](./docs/content/docs/guide/wasm.mdx).

### Reconnect

```typescript
const client = new ButtplugClient("ws://127.0.0.1:12345", {
  autoReconnect: true,
  reconnectDelay: 1000,
  maxReconnectDelay: 30_000,
  maxReconnectAttempts: 10,
});

client.on("connection.reconnected", () => {
  console.log("reconnected");
});
```

On reconnect the client re-handshakes, refreshes the device list, and emits `connection.reconnected`. `PatternEngine` stops patterns for devices that disappeared.

## Design notes

**Transport.** URL string → `WebSocketTransport`. Custom `Transport` implementations are accepted in the constructor. WASM: `WasmTransport` from `@zendrex/buttplug.js/wasm`.

**Validation.** Schemas live in `src/protocol/schema`. Public types are inferred from them.

**Devices.** `Device` parses `DeviceFeatures` from the server descriptor. `canOutput`, `canRead`, and `canSubscribe` gate commands; unsupported calls throw `DeviceError` with `deviceIndex`.

**Events.** Emittery v2 shape: handlers get `{ data }` (and `{ name, data }` when needed). `client.on(...)` returns an unsubscribe function; `client.clearListeners()` and `client.dispose()` tear down.

**Patterns.** `@zendrex/buttplug.js/patterns` keeps the scheduler out of the main bundle. `ButtplugClient` implements `PatternClient`.

## Package exports

| Import | Provides |
| --- | --- |
| `@zendrex/buttplug.js` | `ButtplugClient`, `Device`, errors, loggers, `WebSocketTransport`, protocol types |
| `@zendrex/buttplug.js/patterns` | `PatternEngine`, `PRESETS`, `PRESET_NAMES`, `listPresets`, pattern types |
| `@zendrex/buttplug.js/wasm` | `WasmTransport` (peer: `buttplug-wasm-blob`) |

## API reference

### Client

```typescript
const client = new ButtplugClient(urlOrTransport, options?);

await client.connect();
await client.startScanning();
await client.stopScanning();
await client.stopAll();
await client.disconnect();
client.dispose();

client.connected;   // boolean
client.scanning;    // boolean
client.devices;     // Device[]
client.serverInfo;  // ServerInfo | null
```

**Connection:** `connection.connecting`, `connection.connected`, `connection.disconnected`, `connection.reconnecting`, `connection.reconnected`, `connection.error`

**Devices:** `device.added`, `device.removed`, `device.updated`, `device.list`, `device.error`

**Scan:** `scan.started`, `scan.finished`

**Sensors:** `input.reading`

**Options:** `clientName`, `requestTimeout`, `autoPing`, `autoReconnect`, `reconnectDelay`, `maxReconnectDelay`, `maxReconnectAttempts`, `logger`, `verbose`

### Device outputs

| Method | Output type |
| --- | --- |
| `vibrate()` | `Vibrate` |
| `rotate()` | `Rotate` / `RotateWithDirection` |
| `oscillate()` | `Oscillate` |
| `constrict()` | `Constrict` |
| `spray()` | `Spray` |
| `temperature()` | `Temperature` |
| `led()` | `Led` |
| `position()` | `Position` / `HwPositionWithDuration` |
| `stop()` | stops outputs and/or sensor subscriptions |

`OUTPUT_TYPES` and `INPUT_TYPES` list protocol feature names the library recognizes.

### Pattern engine

```typescript
engine.play(deviceOrIndex, presetName, options?);
engine.play(deviceOrIndex, tracks, options?);
engine.play(deviceOrIndex, descriptor, options?);

engine.stop(patternId);
engine.stopAll();
engine.list();
engine.dispose();
```

### Errors

All extend `ButtplugError`:

| Class | When |
| --- | --- |
| `ConnectionError` | Transport failure |
| `HandshakeError` | Handshake rejected |
| `ProtocolError` | Server error message (`code` from `ErrorCode`) |
| `DeviceError` | Missing capability or invalid pattern target (`deviceIndex`) |
| `TimeoutError` | `timeout` exceeded (`operation`, `timeoutMs`) |

`formatError(err)` stringifies unknown throws safely.

### Logging

Silent by default. `verbose: true` → console; explicit `logger` in options takes precedence. Wire traffic: browser DevTools → Network → WebSocket → Messages.

## Docs

Site source is in [`docs/`](./docs). Local dev:

```bash
bun run docs
```

Guides: [getting started](./docs/content/docs/guide/getting-started.mdx), [devices](./docs/content/docs/guide/devices.mdx), [commands](./docs/content/docs/guide/commands.mdx), [events](./docs/content/docs/guide/events.mdx), [WASM](./docs/content/docs/guide/wasm.mdx), [patterns](./docs/content/docs/patterns/index.mdx).

## License

MIT

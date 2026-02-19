# @zendrex/buttplug.js

Modern TypeScript client for the [Buttplug](https://buttplug.io) intimate hardware protocol v4. Connect to [Intiface Central](https://intiface.com/central/), discover devices, and control them with a type-safe API.

## Features

- Full Buttplug protocol v4 implementation over WebSocket
- 10 output types — vibration, rotation, position, oscillation, constriction, temperature, LED, spray, and more
- 5 sensor types — battery, RSSI, pressure, button, position (one-shot reads and subscriptions)
- Pattern engine with 7 built-in presets, custom keyframes, and easing curves
- Auto-reconnect with exponential backoff
- Zod-validated protocol messages with full type inference
- ESM and CJS dual-package output with `.d.ts` types
- Zero config — point at Intiface Central and go

## Prerequisites

[Intiface Central](https://intiface.com/central/) must be running on your machine or network. It manages hardware connections and exposes a WebSocket server (default `ws://127.0.0.1:12345`).

## Install

```bash
bun add @zendrex/buttplug.js
# or
npm install @zendrex/buttplug.js
```

## Quick Start

```typescript
import { ButtplugClient, consoleLogger } from "@zendrex/buttplug.js";

const client = new ButtplugClient("ws://127.0.0.1:12345", {
  logger: consoleLogger,
});

await client.connect();

client.on("deviceAdded", async ({ device }) => {
  console.log(`Found: ${device.displayName ?? device.name}`);

  if (device.canOutput("Vibrate")) {
    await device.vibrate(0.5);
    setTimeout(() => device.stop(), 2000);
  }
});

await client.startScanning();
```

## API at a Glance

### Client

```typescript
const client = new ButtplugClient(url, options?);

await client.connect();
await client.startScanning();
await client.stopAll();
await client.disconnect();
client.dispose();             // cleanup listeners and internal state

client.connected;   // boolean
client.devices;     // Device[]
client.serverInfo;  // ServerInfo | null
```

**Events:** `connected`, `disconnected`, `reconnecting`, `reconnected`, `error`, `scanningFinished`, `deviceAdded`, `deviceRemoved`, `deviceUpdated`, `deviceList`, `inputReading`

### Device

All output values are normalized to `0–1`. Pass a single number for all motors or an array for per-motor control.

```typescript
await device.vibrate(0.5);
await device.rotate(0.5, { clockwise: true });
await device.position(0.8, { duration: 500 });
await device.oscillate(0.7);
await device.constrict(0.4);
await device.stop();

// Sensors
const battery = await device.readSensor("Battery");
const unsub = await device.subscribeSensor("RSSI", (value) => { /* ... */ });
await unsub();

// Capability checks
device.canOutput("Vibrate");   // boolean
device.canRead("Battery");     // boolean
device.canSubscribe("RSSI");   // boolean
```

### Pattern Engine

```typescript
import { ButtplugClient, PatternEngine } from "@zendrex/buttplug.js";

const engine = new PatternEngine(client);

// Built-in preset
const id = await engine.play(deviceIndex, "wave", {
  intensity: 0.8,
  speed: 1.5,
  loop: true,
});

// Custom keyframes
const id2 = await engine.play(deviceIndex, [
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

**Presets:**

| Preset | Description | Loops |
|--------|-------------|-------|
| `pulse` | Square wave on/off | yes |
| `wave` | Smooth sine wave oscillation | yes |
| `ramp_up` | Gradual increase to maximum | no |
| `ramp_down` | Gradual decrease to zero | no |
| `heartbeat` | Ba-bump heartbeat rhythm | yes |
| `surge` | Build to peak then release | no |
| `stroke` | Full-range position strokes | yes |

**Easings:** `linear`, `easeIn`, `easeOut`, `easeInOut`, `step`

### Error Handling

All errors extend `ButtplugError`:

| Error | Context |
|---|---|
| `ConnectionError` | WebSocket/transport failure |
| `HandshakeError` | Server rejected handshake |
| `ProtocolError` | Server protocol error (has `.code`) |
| `DeviceError` | Device operation failed (has `.deviceIndex`) |
| `TimeoutError` | Operation timed out (has `.operation`, `.timeoutMs`) |

### Auto-Reconnect

```typescript
const client = new ButtplugClient("ws://127.0.0.1:12345", {
  autoReconnect: true,
  reconnectDelay: 1000,       // initial delay
  maxReconnectDelay: 30000,   // backoff cap
  maxReconnectAttempts: 10,
});
```

On reconnection, the client re-handshakes, reconciles the device list, and emits `reconnected`. The pattern engine automatically stops patterns for removed devices.

### Cleanup

```typescript
// Graceful shutdown
await client.disconnect();

// Release all internal state and event listeners
client.dispose();

// Pattern engine cleanup
engine.dispose();
```

## Documentation

Full API reference and guides are available in the [`docs/`](./docs) directory. To run locally:

```bash
cd docs && bun run dev
```

## License

[MIT](./LICENSE)

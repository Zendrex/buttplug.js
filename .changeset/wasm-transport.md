---
"@zendrex/buttplug.js": minor
---

Added `WasmTransport` for running the Buttplug server in-browser via `buttplug-wasm-blob` — no Intiface Central required. Exposed from the new `@zendrex/buttplug.js/wasm` subpath; `buttplug-wasm-blob` is an optional peer dependency. Requires a Chromium-family browser served over HTTPS (Web Bluetooth).

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

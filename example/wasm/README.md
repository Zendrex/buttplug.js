# WASM transport example

Runs the Buttplug server in-process via `buttplug-wasm-blob` — no Intiface Central required. Web Bluetooth handles hardware discovery.

## Requirements

- Chromium-family browser (Chrome, Edge, Opera). Firefox and Safari lack Web Bluetooth.
- HTTPS or `localhost`. Web Bluetooth refuses insecure origins.
- A Bluetooth-capable host machine.

## Run (from repo root)

```bash
bun install
bun run example:wasm
```

Open `http://localhost:5173` in Chrome, click **Connect** → **Scan**, pair a device through the Bluetooth prompt.

`localhost` is a secure context, so HTTPS is not required for local testing. Vite aliases `@zendrex/buttplug.js` and `@zendrex/buttplug.js/wasm` to the local `src/` — no build needed; edits hot-reload.

## Standalone use

Outside the monorepo:

```bash
bun add @zendrex/buttplug.js buttplug-wasm-blob
```

Then bundle with Vite (or any bundler) and serve from `localhost` or an HTTPS origin.

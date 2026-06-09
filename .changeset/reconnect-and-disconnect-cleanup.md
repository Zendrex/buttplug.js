---
"@zendrex/buttplug.js": patch
---

Fix auto-reconnect re-arming and trim disconnect teardown.

- **Auto-reconnect**: reconnect now arms only on an *unexpected* transport close, not on every `connection.disconnected` emit. Explicit `disconnect()` — including server ping-timeout teardown — no longer re-triggers reconnection.
- **Disconnect**: the client no longer sends a protocol `Disconnect` message during teardown; teardown still stops all devices and cancels in-flight requests.

Also includes an internal declutter pass (shared transport event-emitter base, folded single-use helpers, direct feature-array filters) with no public API changes.

---
"@zendrex/buttplug.js": patch
---

Fixed Proxy compatibility for all classes by replacing JS `#private` fields with TypeScript `private` keyword fields. Wrapping instances (e.g. `Device`, `ButtplugClient`) in a `Proxy` no longer throws `TypeError` when accessing properties or calling methods.

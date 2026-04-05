---
"@zendrex/buttplug.js": minor
---

Remove built-in device message timing gap limit since the interface server already handles dropping commands outside of the device's command window.

- Removed `messageTimingGap` getter from `Device`
- Removed `messageTimingGap` from `PatternDevice` interface
- Pattern engine tick interval defaults to 50ms (20Hz), configurable per-pattern via `tickInterval` in `PatternPlayOptions`

---
"@zendrex/buttplug.js": minor
---

**Breaking:** All device output methods now accept **normalized 0–1 floats** instead of device-range integers. The library maps each 0–1 value to the feature's server-reported device range internally, so `0.5` always means "midpoint" regardless of whether the device exposes a 0–100, 0–20, or any other range.

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

# @zendrex/buttplug.js

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

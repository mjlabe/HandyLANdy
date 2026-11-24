# HandyLANdy Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for isolated tasks and independent review. Track execution below.

**Goal:** Deliver an iOS-first LAN printer monitor with a reusable TypeScript core and a Makefile for local simulator/device builds.

**Architecture:** Expo Router screens consume a profile repository and printer-session facade. Shared TypeScript handles MQTT report merging, session ownership, and JPEG framing; existing native libraries handle TLS sockets and RTSP decoding. Foreground lifecycle owns connections.

**Tech Stack:** Expo, React Native, TypeScript, Expo Router, SecureStore, AsyncStorage, react-native-tcp-socket, MQTT.js, VLC player, Node test runner with tsx.

## Execution checklist

- [ ] Scaffold official Expo starter, remove sample screens, set app identifiers and permissions, install compatible dependencies. Work in the requested workspace; the repository has no prior implementation to isolate.
- [ ] Establish typed profile/status/session contracts in `src/printer/types.ts`. Write failing behavioral tests for profile validation, status merging, MQTT messages, JPEG fragmentation/bounds, and reconnect/session isolation before implementing them.
- [ ] Implement `src/printer` protocol core and native socket integration, with scoped self-signed TLS opt-in, timeout/reconnect handling, and cancellation. Use `npm test` for the red/green cycle.
- [ ] Implement `src/storage` profile persistence with credential-store isolation; write failure tests for secret rollback and deletion. Keep credentials out of profile metadata and logs.
- [ ] Build application state provider and lifecycle, setup/edit/delete/select profiles, live dashboard, demo mode, fullscreen camera, and settings in `src/screens` and `src/components`. Camera errors must remain independent of MQTT state.
- [ ] Implement `Makefile` and `scripts/ios.mjs` for setup, Metro, simulator/device run, build-only targets, and checks. Verify device argument quoting and failure propagation with a fake process runner and `make -n`.
- [ ] Add MIT license, source/dependency notices, setup instructions, compatibility matrix, and CI checks. Document physical printer verification accurately.
- [ ] Run `make check`, Expo configuration/dependency diagnostics, iOS prebuild/build, and simulator smoke checks. Use real runtime evidence to correct integration failures.
- [ ] Obtain independent spec and code-quality review; resolve actionable findings. Record validation evidence and remaining hardware limitations.

## Behavioral acceptance examples

```ts
// A partial report must preserve earlier values while honoring zero.
const first = mergeReport({}, { print: { nozzle_temper: 210, mc_percent: 40 } });
const second = mergeReport(first, { print: { mc_percent: 0 } });
assert.equal(second.nozzleTemperature, 210);
assert.equal(second.progress, 0);
```

```sh
make help
make -n ios-sim SIMULATOR="iPhone 17"
make -n ios-device DEVICE="My iPhone"
make check
make build-ios-sim SIMULATOR="iPhone 17"
```

Physical acceptance additionally needs an actual printer: receive authenticated MQTT reports, decode a real camera frame, reject incorrect credentials, and reconnect after foreground/background transitions. Simulator success is not hardware verification.

# HandyLANdy

An open-source, iOS-first LAN monitor for Bambu Lab printers, built with Expo SDK 58, React Native 0.88 and TypeScript. The shared React Native UI also targets Android; Android native builds and printer protocols have not been verified on a physical device.

HandyLANdy is a foreground monitoring app: save a printer, connect on your local network, and view its camera, job progress, temperatures, fans and AMS data when the printer reports them. Demo mode provides sample data without a printer. There is no Bambu cloud login, remote relay, background monitoring, print upload or printer-control workflow. No real printer hardware has been tested with this implementation yet; model and firmware compatibility must be checked on your own printer.

## Run locally on iOS

Use a custom development build. Expo Go does not contain the native TCP or VLC libraries required for real printer connections and video.

Prerequisites:

- macOS with full Xcode installed, opened once, and selected as the active developer directory. This workspace uses Xcode 27.
- An iOS simulator runtime installed through Xcode Settings > Components, or a trusted physical iPhone/iPad with Developer Mode enabled.
- Node.js 22.13 or newer, npm, Make, and CocoaPods (tested with 1.16.2).
- Network access for npm dependencies, Expo's agent CLI, and CocoaPods/native framework downloads on first build.

```sh
make setup
make ios-sim
```

`setup` checks the local Xcode and CocoaPods tools, then runs `npm ci`. It reports missing prerequisites; it does not install operating-system software or accept Xcode licenses for you. The first native build generates the iOS project, installs pods, compiles the development client, and starts Metro. Later JavaScript changes can reload through Metro; native dependency/configuration changes require rebuilding.

Select a simulator by exact name or UDID. A shutdown simulator is valid: Expo boots it when launching. Without a selector, HandyLANdy prefers a booted simulator, then an available iPhone simulator.

```sh
make ios-sim SIMULATOR='iPhone 17'
make ios-sim SIMULATOR='YOUR-SIMULATOR-UDID'
```

To list installed simulators:

```sh
xcrun simctl list devices available
```

Physical devices require an Apple development signing identity and provisioning profile for `org.handylandy.app`. Add your Apple account in Xcode Settings > Accounts, connect and trust the device, and enable Developer Mode. Set `ios.appleTeamId` in Expo app configuration or supply `DEVELOPMENT_TEAM` on the Make command before the first device build. Xcode is allowed to update provisioning profiles using your configured Apple account. Your Apple team may require changing the bundle identifier to one it can provision. Local builds do not need an Expo/EAS account.

```sh
make ios-device
make ios-device DEVICE='My iPhone'
make ios-device DEVICE='YOUR-DEVICE-UDID'
make ios-device DEVICE='YOUR-DEVICE-UDID' DEVELOPMENT_TEAM='AB12CD34EF'
```

The device target auto-selects only when exactly one available physical iOS device is connected. With multiple devices, supply its exact name or UDID. `xcrun xcdevice list` shows available physical devices and identifiers.

## Build without launching

These targets finish after native compilation. They do not boot a simulator, install/launch an app, or start a persistent Metro server. The default `Release` configuration bundles JavaScript into the app; `CONFIGURATION=Debug` builds a development binary that needs Metro (`make start`) when run.

```sh
make build-ios-sim
make build-ios-device DEVELOPMENT_TEAM='AB12CD34EF'
make build-ios-sim CONFIGURATION=Debug
```

Device compilation still requires valid signing assets for the configured bundle identifier. `DEVELOPMENT_TEAM` overrides the team for compile-only device builds; it does not provision an account or create signing credentials. The resulting `.app` is an Xcode build product, not an App Store archive or an exported `.ipa`.

| Target | Default app output |
| --- | --- |
| `build-ios-sim` | `build/ios-simulator/Build/Products/Release-iphonesimulator/HandyLANdy.app` |
| `build-ios-device` | `build/ios-device/Build/Products/Release-iphoneos/HandyLANdy.app` |

For Debug builds, replace `Release` in those paths with `Debug`. Optional `SIMULATOR`/`DEVICE` selectors also work for compile-only targets; without them, Xcode uses a generic destination. Run targets use the same local Xcode intermediates, then pass the exact compiled app to Expo for installation and launch.

Native projects use Expo Continuous Native Generation and are ignored by git. Build commands explicitly use `prebuild --no-clean`; they do not delete your generated native projects. Change native configuration through Expo app config/config plugins, then rebuild. Keep custom source out of generated `ios/` and `android/` folders. Do not run build targets concurrently against the same generated native project.

Allow at least 10 GB of free disk space for the initial iOS dependencies and build intermediates. Normal targets preserve these intermediates for faster subsequent builds.

Simulator builds use ad-hoc signing to preserve the entitlements required by Keychain/SecureStore. They do not need an Apple developer account. Disabling code signing entirely can make profile saves fail with a missing-entitlement error.

## Connect a printer

1. Enable LAN access/LAN-only mode on the printer as required by its firmware. Keep the phone and printer on a reachable local network and allow iOS Local Network permission.
2. Add its friendly name, local IPv4 address/hostname, serial number and LAN access code. Choose the camera protocol that matches your printer. The UI suggests RTSPS for X1/P2/H2 families and authenticated TLS JPEG for P1/A1 families; you can override the transport. Firmware/model behavior varies and these suggestions are not hardware-tested.
3. Open the printer to connect. MQTT telemetry uses TLS port `8883`; camera paths use RTSPS port `322` or JPEG port `6000`. Permit those connections through your local firewall. Guest Wi-Fi/client isolation and a printer IP that has changed can prevent connections.
4. If your printer uses a self-signed certificate, enable the profile's explicit certificate-trust option only for a printer you trust. Disabling certificate verification reduces server-identity protection on that connection.

Profiles and connection preferences are stored locally with AsyncStorage. LAN access codes use native `expo-secure-store` (Keychain/Android Keystore); they are kept out of profile metadata. Web/demo mode cannot save real printer credentials. Camera URLs necessarily carry the printer's authentication at runtime: keep access codes and live stream URLs out of screenshots, issue reports and logs.

Connections and camera sessions are intended for the active foreground screen and stop when the app backgrounds. Missing printer fields remain unavailable; demo values should not be interpreted as readings from your printer.

## Compatibility

These are protocol profiles, not claims of tested model/firmware support.

| Printer family | Suggested camera | Physical printer status |
| --- | --- | --- |
| X1 / X1 Carbon / X1E | RTSPS, port 322 | Unverified |
| P1P / P1S | TLS JPEG, port 6000 | Unverified |
| A1 / A1 Mini | TLS JPEG, port 6000 | Unverified |
| P2S | RTSPS, port 322 | Unverified |
| H2D / H2S / H2C | RTSPS, port 322 | Unverified |

MQTT uses TLS port 8883 with an explicitly entered serial number for all profiles. Other models can use a compatible profile with the camera transport override, but are also unverified. Dual-nozzle-specific telemetry is not normalized in this version. Android native transport/camera interoperability remains unverified. The Android socket library checks the certificate chain when verification is enabled but does not independently enable TLS hostname verification; iOS uses the connection hostname.

## Dependency patches

`npm ci` applies two small, version-checked patches automatically. They fail with a review message if upstream source locations change:

- `scripts/patch-vlc.mjs` disables native camera diagnostics that can expose authenticated URLs and ensures iOS VLC stream errors emit a generic error event, even without a VLC dialog. Playback itself still uses the upstream native library.
- `scripts/patch-expo.mjs` omits an optional development-launcher toolbar decoration in `expo-dev-launcher` 58.0.21. Its original Swift compiler guard references an iOS 27.1 API unavailable in Xcode 27.0's SDK. This only changes the launcher's optional toolbar appearance.

Review and remove the corresponding patch when upgrading to an upstream version that fixes the issue. No custom Swift/Kotlin application module is required by this implementation.

## Checks and project layout

```sh
make check
# Equivalent: npm run check
node --import tsx --test tests/build-workflow.test.ts
npm run test:native
```

GitHub Actions runs the JavaScript/TypeScript checks on Linux. The automated tests exercise protocol framing/parsing, status normalization, connection lifecycle, storage behavior and build-command argument/failure handling. `test:native` additionally resolves MQTT using the React Native package conditions to catch dependency-export differences. These checks do not establish physical printer compatibility, video decoder behavior, Apple signing, or a successful native build.

Application code lives under `src/`; `src/printer/` contains printer protocols/session logic, `src/storage/` separates profile metadata and credentials, and `src/camera/` contains camera integration. Local iOS orchestration is in `scripts/ios.mjs`. Run `make help` for all commands.

### Local verification

The iOS Debug app was built and launched through the Makefile with Xcode 27.0
on an iPhone 17 simulator. Native Keychain save/reload/deletion, authenticated
MQTT over TLS, and authenticated TLS JPEG decoding were exercised against
temporary loopback-only test servers. The dashboard displayed their synthetic
job, temperature, fan, and AMS readings. Backgrounding closed both intended
printer connections; returning reconnected them. The disposable profile,
credential, and test servers were removed afterward.

Setup validation, demo actions, and fullscreen navigation were exercised by
calling the app's React handlers through Hermes and inspecting actual simulator
screenshots. These checks did not exercise physical taps, gestures, the software
keyboard, or VoiceOver. No physical printer, physical-device signing flow,
Android runtime, or real RTSPS stream has been verified.

Expo Doctor passed 19 of 20 checks. Its remaining React Native Directory check
flags `react-native-tcp-socket` and `react-native-vlc-media-player` as untested
on the New Architecture, and reports missing metadata for the wrapper's
`react-native-vector-icons` dependency. Those diagnostics are retained rather
than suppressed. Native iOS MQTT/JPEG fixture testing does not establish all
camera, platform, or firmware compatibility.

## License and acknowledgments

HandyLANdy source is [MIT licensed](LICENSE). [PandaBeFree](https://github.com/MiguelSchulz/panda-be-free) is an MIT-licensed protocol/reference project acknowledged for its LAN monitoring work. HandyLANdy is independent of Bambu Lab and VideoLAN.

Dependency licenses are separate from HandyLANdy's MIT license. In particular, the MIT-licensed VLC React Native wrapper brings in MobileVLCKit/libVLC, which have LGPL terms and additional bundled-component notices. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for versions, upstream source/license links, and distribution requirements to review before shipping binaries.

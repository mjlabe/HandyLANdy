# HandyLANdy

A React Native app for monitoring Bambu Lab printers over a local network. Built with Expo SDK 58 and TypeScript, with iOS as the first target.

View job progress, temperatures, fans, AMS data, and the camera for a saved printer. Connections run in the foreground. Demo mode uses labeled sample data. Cloud accounts, printer controls, print uploads, and background notifications are outside the current scope.

## Development

For local iOS builds, install macOS, Xcode with an iOS simulator runtime, Node.js 22.13+, npm, Make, and CocoaPods. Local builds have been exercised with Xcode 27.0 and CocoaPods 1.16.2. Allow at least 10 GB of free disk space for native dependencies and build outputs.

```sh
make setup
make ios-sim
```

`make setup` checks prerequisites and runs `npm ci`. Build targets use the installed Expo CLI, generate the native project, install pods, and compile with Xcode. Run targets also install the app and start Metro. Expo Go cannot load the native TCP and VLC libraries; use a development build.

| Command | Purpose |
| --- | --- |
| `make start` | Start Metro for an installed development build |
| `make ios-sim SIMULATOR='iPhone 17'` | Build and run on a simulator by name or UDID |
| `make ios-device DEVICE='My iPhone' DEVELOPMENT_TEAM='AB12CD34EF'` | Build and run on a connected device |
| `make build-ios-sim` | Build a simulator app without launching |
| `make build-ios-device DEVELOPMENT_TEAM='AB12CD34EF'` | Build a signed device app without launching |
| `make check` | Run TypeScript, ESLint, and tests |
| `make icons` | Generate PNG icons from `assets/icon.svg` |

Use `make help` for all targets. List simulators with `xcrun simctl list devices available` and physical devices with `xcrun xcdevice list`. Without a selector, run targets prefer a booted simulator or require a single connected physical device.

Device builds require a trusted iPhone/iPad with Developer Mode enabled and an Apple signing identity configured in Xcode. Supply `DEVELOPMENT_TEAM` or set `ios.appleTeamId` in `app.json`. The build permits Xcode to update provisioning profiles. Change the bundle identifier if your team cannot provision `org.handylandy.app`. An Expo/EAS account is not required for local builds.

Build-only targets default to Release and include the JavaScript bundle. Run targets default to Debug. Override either with `CONFIGURATION=Debug` or `CONFIGURATION=Release`. Debug apps need Metro when launched.

Build products are under `build/ios-simulator/Build/Products/` or `build/ios-device/Build/Products/`, in the configuration's platform directory. They are `.app` bundles, not App Store archives or exported `.ipa` files. Simulator builds use ad-hoc signing to preserve Keychain entitlements without an Apple developer account.

Native projects and build outputs are generated and ignored. Update native configuration through `app.json` or config plugins, then rebuild. Build targets use non-destructive prebuilds; keep custom code out of `ios/` and `android/`, and do not run native builds concurrently in this checkout.

## Connecting a printer

1. Keep the phone and printer on a reachable local network. Enable LAN access and LAN liveview as required by the printer firmware, and grant iOS Local Network permission. Some firmware requires LAN Only or Developer Mode for third-party access.
2. Enter the printer IP or hostname, serial number, and LAN access code in **Add printer**.
3. Choose a model and camera transport. The suggested transports are listed below and can be overridden.
4. Review the certificate option. Self-signed certificates are allowed by default for new printers; you can disable this in the profile. Traffic stays encrypted, but the printer's identity is not verified while this option is enabled. The setting applies only to that printer.

MQTT uses TLS port **8883**. Cameras use RTSPS port **322** or TLS JPEG port **6000**. Guest Wi-Fi isolation, VPNs, firewall rules, and changed printer IPs can prevent connections.

Profiles are stored locally with AsyncStorage; access codes use Keychain/Android Keystore through SecureStore. Web mode cannot save real printer credentials. Keep access codes and authenticated stream URLs out of logs, screenshots, and issue reports.

## Compatibility and verification

These model profiles suggest a transport; they do not establish hardware compatibility.

| Printer family | Suggested camera |
| --- | --- |
| X1 / X1 Carbon / X1E | RTSPS |
| P1P / P1S | TLS JPEG |
| A1 / A1 Mini | TLS JPEG |
| P2S | RTSPS |
| H2D / H2S / H2C | RTSPS |

The iOS Debug app has been built and run in the simulator. An A1 has supplied live MQTT telemetry over TLS; its firmware version was not recorded. Keychain operations and TLS JPEG decoding have also been exercised with synthetic loopback fixtures. Real camera streams, other printer models, physical-device signing, and the Android runtime remain unverified. Dual-nozzle-specific telemetry is not normalized.

The Android socket dependency validates certificate chains when verification is enabled but does not independently enable TLS hostname verification; iOS uses the connection hostname. React Native Directory marks the TCP and VLC wrappers as untested on the New Architecture, and the VLC wrapper's vector-icons dependency lacks metadata.

## Contributing

Keep changes focused and follow the existing module boundaries:

| Directory | Responsibility |
| --- | --- |
| `src/app/` | Expo Router routes and navigation |
| `src/screens/` | Screen components |
| `src/components/` | Shared UI |
| `src/printer/` | Protocol parsing, transports, and sessions |
| `src/camera/` | Camera rendering |
| `src/state/` | Selection, connection lifecycle, and demo state |
| `src/storage/` | Profile metadata and credentials |
| `scripts/` | Local builds, asset generation, and dependency patches |
| `tests/` | Node tests, run with `tsx` |

Run `make check` before submitting a change. CI runs the same checks on Linux. Tests cover protocol framing, partial reports, connection lifecycle, storage failures, build arguments, and failure propagation. The additional `test:native` pass resolves MQTT with React Native package conditions. These checks do not replace a native build or hardware testing.

Add regression coverage for protocol, storage, or lifecycle changes. For compatibility reports, include the printer model, firmware, platform, and camera transport. State whether evidence comes from a fixture, simulator, or physical printer; remove credentials before sharing logs.

## Dependency patches

`npm ci` applies two version-checked patches. Both fail if upstream source changes and needs review:

- `scripts/patch-vlc.mjs` disables credential-bearing native diagnostics and surfaces generic iOS playback errors from `react-native-vlc-media-player` 1.0.98.
- `scripts/patch-expo.mjs` omits an optional toolbar decoration in `expo-dev-launcher` 58.0.21 that references an iOS 27.1 API unavailable in Xcode 27.0.

Review these patches when upgrading their dependencies and remove them when upstream fixes are available.

## License

HandyLANdy is [MIT licensed](LICENSE) and independent of Bambu Lab. [PandaBeFree](https://github.com/MiguelSchulz/panda-be-free) is the MIT-licensed LAN protocol reference; no source files were copied.

Dependency licenses are separate. The VLC wrapper includes MobileVLCKit/libVLC under LGPL terms. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution, source links, and binary distribution requirements.

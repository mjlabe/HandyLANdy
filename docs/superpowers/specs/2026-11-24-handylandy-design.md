# HandyLANdy first release design

Status: implementation delivered; local iOS and fixture verification are recorded in README.md. Physical printer, real RTSPS, physical-device signing, and Android verification remain outstanding.

## Objective and confirmed requirements

Build HandyLANdy in this repository as an MIT-licensed React Native app for
monitoring Bambu Lab printers. Target iOS first and keep the application and
protocol model portable to Android. The user selected direct LAN connections:
no Bambu account, companion server, or cloud service in the first release.

## Approach

Recommended: Expo with TypeScript, Expo Router, development builds, and
existing native libraries for printer networking and camera
playback. Prefer shared TypeScript protocol logic over custom Swift/Kotlin
modules. Native capability is necessary for direct TCP/TLS and camera decoding,
but writing our own native module is not a starting requirement. Expo Go cannot
load arbitrary third-party native libraries; use an Expo development build.
Keep screens and state management independent of the transport implementation
so Android can use the same application code.

Evaluate `react-native-tcp-socket` for cross-platform TCP/TLS transport and a
JavaScript MQTT client with an injectable transport. For RTSPS, evaluate an
existing native player such as `react-native-vlc-media-player`. Confirm Bambu
RTSPS authentication, self-signed certificate handling, the selected Expo/RN
version, and dependency license notices before committing to that player.
RTSP support alone does not establish Bambu RTSPS compatibility. Parse the
P1/A1 TLS JPEG framing in TypeScript where practical and render decoded images
with existing image components. Add a narrowly scoped local native module only
if compatibility or measured performance requires it, documenting the reason.

Alternative: bare React Native. This offers direct native project control but
requires more maintenance of iOS and Android build configuration. It does not
remove the need for native printer transport and camera integrations.

A companion server was considered and excluded by the user's direct LAN choice.

## First implementation scope

- Guided setup explaining the printer IP, serial number, LAN access code,
  local network permission, and applicable printer LAN/Developer Mode settings.
- Save, select, edit, and remove multiple printer profiles. Connect only to the
  selected printer initially, avoiding unnecessary network and battery use.
- A dashboard with connection state, job name, print state, progress, remaining
  time, current/total layers, available temperatures, fan readings, and AMS
  material/color information. Missing readings display as unavailable.
- Live camera with reconnect and fullscreen display. Support RTSPS and the
  TLS JPEG protocol used by different printer families; expose a transport
  override rather than assume every Bambu camera is RTSP.
- A clearly labeled demo mode for development without physical printers. Demo
  state and frames must never be presented as a live printer connection.
- Settings with connection details, permission help, privacy information,
  licenses, and reference attribution.

The first release is a foreground monitor. Printing uploads, motion commands,
temperature changes, cloud access, widgets, Live Activities, and background
completion notifications are separate follow-up features.

## Application structure and data flow

Use routes only for navigation; place screens, reusable components, domain
models, and connection services in separate modules under `src/`.

A typed printer-session interface owns connect, disconnect, subscription,
connection events, and camera lifecycle. Its live implementation wraps the
selected networking and camera libraries. A demo implementation feeds
deterministic fixtures through the same interface. Platform capability reporting prevents unavailable
native integrations from silently behaving like successful connections.

MQTT reports enter a TypeScript normalizer that merges partial updates into
the selected printer's state. Absent fields preserve previous values; zero
and false overwrite previous values correctly. Reject malformed payloads
without crashing. A session identifier prevents late events from one printer
from changing another printer's dashboard.

Use MQTT over TLS on port 8883, username `bblp`, and the printer access code.
Subscribe to `device/<serial>/report`. Request an initial status snapshot on
`device/<serial>/request` after subscription is acknowledged. Status requests
are distinct from physical printer control commands.

Keep H.264 decoding in the native player. Share TLS JPEG framing and protocol
logic in TypeScript where practical; keep buffers bounded. Start camera
streaming when its screen is visible, stop it when hidden, and release sockets
and decoders on disconnect or backgrounding.

## Storage, trust, and lifecycle

Store access codes in the OS credential store and keep non-secret profile
metadata separately. Redact credentials from errors and logs. Deleting a
profile also deletes its stored access code. Do not send analytics or printer
data to an external service.

Bambu printers use self-signed certificates. Any compatibility handling must
be scoped to explicit printer connections and described accurately in setup;
never disable certificate verification globally. Do not imply that encrypted
transport alone proves the printer's identity.

Model connection states explicitly: disconnected, connecting, connected,
reconnecting, and failed. Track the last status report independently of socket
state and mark readings stale after 30 seconds without a valid report. Display
actionable permission, authentication, timeout, and unsupported-camera errors.
Use capped reconnect delays while the app is active. Cancel reconnect attempts
when switching printers, disconnecting, or entering the background. Reconnect
and refresh status when the app returns to the foreground.

## Interface

Use a compact, native-feeling dashboard with clear status labels, large print
progress, a camera card, temperature cards, and AMS slots. Support system light
and dark appearance, safe areas, Dynamic Type, VoiceOver labels, and status cues
that do not rely on color alone. Setup and connection errors remain usable
without a working camera connection.

## Portability and compatibility claims

Shared TypeScript screens, profile validation, MQTT normalization, and session
interfaces must remain platform independent. Prefer dependencies that support
both iOS and Android, implementing and validating the iOS integration first.
Android validation and any necessary platform-specific camera work are a
subsequent milestone; do not describe unverified Android connections as working.

Begin with X1-series RTSPS and P1/A1-series JPEG profiles, using PandaBeFree's
protocol handling as a reference. Additional model names can be offered only
with an explicit unverified status until tested. Neither a reference project's
model list nor a successful build establishes hardware compatibility.

## Makefile workflow (required)

Provide a root `Makefile` as the documented entry point for development:

- `make help`: list targets and show simulator/device selection examples.
- `make setup`: install the locked JavaScript dependencies and prepare the
  local prerequisites needed by the project's development workflow.
- `make start`: start Metro for an already-installed development build.
- `make ios-sim`: build, install, and launch on an iOS simulator. Accept
  `SIMULATOR="<name or UDID>"`; use a sensible available default when omitted.
- `make ios-device`: build, sign, install, and launch on a physical iPhone.
  Accept `DEVICE="<name or UDID>"`; offer device selection when omitted.
- `make build-ios-sim` and `make build-ios-device`: compile the respective
  development artifacts without requiring Metro to remain running. Document
  output locations and signing prerequisites for physical devices.
- `make check`: run type checking, automated protocol/session tests, and the
  project's configured static checks.

Keep targets thin wrappers around package scripts and Expo/Xcode tooling.
Quote simulator/device values correctly, surface command failures, and document
Xcode, CocoaPods, device Developer Mode, and signing setup. Do not require EAS
or an Expo account for the local simulator/device workflow. Normal targets must
not perform destructive cleanup or regenerate native projects with `--clean`.

## Validation and acceptance

- Type checking and the required Expo configuration/dependency checks pass.
- Unit tests exercise partial MQTT reports, zero values, malformed messages,
  profile validation, session isolation, and reconnect cancellation.
- Protocol parser checks cover fragmented input, invalid frame lengths, and
  teardown. Never allocate memory solely from an unchecked network length.
- The Makefile's help and dry-run commands work; verify real simulator/device
  build targets where the toolchain and connected hardware permit, and state
  clearly which targets have only been inspected or dry-run.
- Generate and compile the iOS development build when the local Xcode toolchain
  is available; report signing/toolchain blockers precisely.
- Inspect setup, demo dashboard, printer switching, and errors in an iOS
  simulator or device when available.
- Physical printer acceptance requires a real LAN connection, incoming status,
  a decoded camera frame, credential rejection, and foreground/background
  reconnect checks. Report these as unverified until performed.
- Deliver setup/build instructions, a compatibility matrix, an MIT license,
  and notices for any reused source or bundled dependencies.

## Sources and installed tooling

- [PandaBeFree](https://github.com/MiguelSchulz/panda-be-free), reference checkout
  examined for MQTT and both camera implementations. It uses the MIT license;
  preserve its copyright and license if adapting its code.
- [Bambu Lab third-party integration guidance](https://blog.bambulab.com/updates-and-third-party-integration-with-bambu-connect/).
  The LAN protocol details come from community implementations; do not describe
  them as a comprehensive, officially supported Bambu SDK.
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
  and [custom native code](https://docs.expo.dev/workflow/customizing/).
- Candidate libraries: [react-native-tcp-socket](https://github.com/Rapsssito/react-native-tcp-socket)
  for cross-platform TCP/TLS and [react-native-vlc-media-player](https://github.com/razorRun/react-native-vlc-media-player)
  for native RTSP playback. Bambu-specific interoperability remains to be tested.
- [Expo local builds](https://docs.expo.dev/guides/local-app-development/)
  document the simulator/device build and run workflow to wrap in the Makefile.
- Installed all 24 skills from [Expo's official skills repository](https://github.com/expo/skills),
  including the experimental module migration skill, at revision
  `e577fe1524106faa3b241430874cb3c495e6b9db` in `/Users/marc/.codex/skills`.
  Verified all 121 installed files against that revision. Installed skills
  become discoverable on the next user turn.

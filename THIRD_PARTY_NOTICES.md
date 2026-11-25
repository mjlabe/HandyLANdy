# Third-party notices

HandyLANdy's own source is MIT licensed. Dependency licenses remain separate.
This inventory accompanies the source repository; it is not a complete notice
and corresponding-source bundle for a distributed app binary.

## Reference and principal dependencies

| Component | Version / role | Copyright | License |
| --- | --- | --- | --- |
| [PandaBeFree](https://github.com/MiguelSchulz/panda-be-free) | Protocol reference; no source files copied | © 2026 PandaBeFree Contributors | [MIT](https://github.com/MiguelSchulz/panda-be-free/blob/main/LICENSE) |
| [react-native-tcp-socket](https://github.com/Rapsssito/react-native-tcp-socket) | 6.4.3; native TCP/TLS | © 2019 Rapsssito | MIT |
| [MQTT.js](https://github.com/mqttjs/MQTT.js) | 5.16.1; MQTT protocol | © 2015–2016 MQTT.js contributors; © 2011–2014 Adam Rudd | MIT |
| [react-native-vlc-media-player](https://github.com/razorRun/react-native-vlc-media-player) | 1.0.98; native player wrapper | © 2016 Brent Vatne, Baris Sencan | MIT |

The MIT permission and disclaimer for these components follows:

> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

Expo, React, React Native, AsyncStorage, Buffer, Readable Stream, and other
direct/transitive dependencies supply their own license files. Preserve their
notices when distributing the app. `package-lock.json` records resolved npm
versions; generated native lockfiles record native versions.

## VLC engine

The wrapper's MIT license does not relicense its native video engine:

- The installed iOS podspec declares **MobileVLCKit 3.5.1**. VLCKit/libVLC use
  LGPL terms and contain additional third-party components. The downloaded
  framework includes `ios/Pods/MobileVLCKit/COPYING.txt` after pod installation.
- The installed Android Gradle declaration uses
  **`org.videolan.android:libvlc-all:3.6.3`**. Android has not been built or
  hardware-verified in this project.
- Upstream sources and license information:
  [VLCKit](https://code.videolan.org/videolan/VLCKit),
  [VLCKit COPYING](https://github.com/videolan/vlckit/blob/master/COPYING),
  [libVLC](https://www.videolan.org/vlc/libvlc.html), and
  [VLC Android](https://github.com/videolan/vlc-android).

Before shipping binaries, assemble the exact native framework/AAR's notices,
applicable library source and modifications, and any required relinking or
replacement materials. This source inventory does not claim that a release
distribution bundle has been assembled. Keep the installed components' exact
licenses rather than relying only on links to moving upstream branches.

## Local dependency modifications

The source-controlled postinstall scripts modify the MIT-licensed VLC React
Native wrapper to suppress credential-bearing diagnostics and surface generic
playback errors. They also omit an optional toolbar decoration from the
MIT-licensed Expo development launcher for Xcode 27.0 compatibility. These
patches are documented in the README; the upstream copyright notices remain.

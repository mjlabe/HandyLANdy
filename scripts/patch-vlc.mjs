// Keep the upstream player, with a small reproducible patch to its diagnostics.
// VLC debug logs/dialog text may include the authenticated stream URL.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function patchIosSource(source) {
  const macro = '#if !defined(DEBUG) || !(TARGET_IPHONE_SIMULATOR)';
  const patchedMacro = '#if 1 // HandyLANdy: never log camera credentials';
  const logger = /VLCConsoleLogger \*consoleLogger = \[\[VLCConsoleLogger alloc\] init\];\s*consoleLogger.level = kVLCLogLevelDebug;\s*library.loggers = @\[consoleLogger\];/;
  if (!(source.includes(macro) || source.includes(patchedMacro)) || !(logger.test(source) || source.includes('library.loggers = @[]; // HandyLANdy'))) {
    throw new Error('VLC iOS logging source changed; review the privacy patch before building.');
  }
  return source.replace(macro, patchedMacro).replace(logger, 'library.loggers = @[]; // HandyLANdy: no credential-bearing diagnostics');
}

export function patchAndroidSource(source) {
  const log = 'Log.i(TAG, "Certificate dialog - Title: " + title + ", Text: " + text);';
  const patchedLog = 'Log.i(TAG, "Camera certificate dialog"); // HandyLANdy: omit authenticated URL';
  if (!source.includes(log) && !source.includes(patchedLog)) throw new Error('VLC Android logging source changed; review the privacy patch before building.');
  return source.replace(log, patchedLog);
}

export function patchIosErrorEvents(source) {
  const marker = '// This callback doesn\'t have any data about the error, we need to rely on the error dialog';
  const patched = '// HandyLANdy: always surface stream errors without credential-bearing details\n                if (self.onVideoError) {\n                    self.onVideoError(@{@"target": self.reactTag, @"message": @"Camera stream failed"});\n                }';
  if (!source.includes(marker) && !source.includes(patched)) throw new Error('VLC iOS error source changed; review the camera lifecycle patch.');
  return source.replace(marker, patched);
}

async function main() {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)), 'node_modules/react-native-vlc-media-player');
  const files = [
    ['ios/RCTVLCPlayer/RCTVLCPlayer.m', source => patchIosErrorEvents(patchIosSource(source))],
    ['android/src/main/java/com/yuanzhou/vlc/vlcplayer/ReactVlcPlayerView.java', patchAndroidSource],
  ];
  for (const [file, patch] of files) {
    const path = resolve(root, file);
    const original = await readFile(path, 'utf8');
    const modified = patch(original);
    if (original !== modified) await writeFile(path, modified);
  }
  console.log('Applied VLC camera privacy patch.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

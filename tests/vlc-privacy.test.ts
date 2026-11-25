import assert from 'node:assert/strict';
import test from 'node:test';
import { patchAndroidSource, patchIosSource, patchIosErrorEvents } from '../scripts/patch-vlc.mjs';

test('disables dependency debug loggers which can expose camera URL credentials', () => {
  const source = `#if !defined(DEBUG) || !(TARGET_IPHONE_SIMULATOR)\n    #define NSLog(...)\n#endif\nVLCConsoleLogger *consoleLogger = [[VLCConsoleLogger alloc] init];\n    consoleLogger.level = kVLCLogLevelDebug;\n    library.loggers = @[consoleLogger];`;
  const patched = patchIosSource(source);
  assert.match(patched, /#if 1[^\n]*\n\s*#define NSLog/);
  assert.match(patched, /library.loggers = @\[\];/);
  assert.doesNotMatch(patched, /kVLCLogLevelDebug/);
  assert.equal(patchIosSource(patched), patched);
});

test('Android camera dialogs cannot print credential-bearing URLs', () => {
  const source = 'Log.i(TAG, "Certificate dialog - Title: " + title + ", Text: " + text);';
  const patched = patchAndroidSource(source);
  assert.doesNotMatch(patched, /\+ title|\+ text/);
  assert.equal(patchAndroidSource(patched), patched);
});

test('fails closed if a dependency update changes the patch location', () => {
  assert.throws(() => patchIosSource('unexpected upstream source'), /changed/i);
  assert.throws(() => patchAndroidSource('unexpected upstream source'), /changed/i);
});

test('native VLC error states emit a safe event even without an error dialog', () => {
  const original = '// This callback doesn\'t have any data about the error, we need to rely on the error dialog\n                [self _release];';
  const patched = patchIosErrorEvents(original);
  assert.match(patched, /self.onVideoError\(@\{/);
  assert.match(patched, /@"Camera stream failed"/);
  assert.equal(patchIosErrorEvents(patched), patched);
  assert.throws(() => patchIosErrorEvents('upstream changed'), /changed/);
});

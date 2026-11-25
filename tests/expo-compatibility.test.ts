import assert from 'node:assert/strict';
import test from 'node:test';
import { patchDevLauncherToolbar } from '../scripts/patch-expo.mjs';

test('keeps optional development toolbar compilable without the iOS 27.1 SDK', () => {
  const original = '#if os(iOS) && compiler(>=6.4)\n    if #available(iOS 27.1, *) {\n      axisBehavior(.verticalPreferred)\n    } else {\n      self\n    }\n#else\n    self\n#endif';
  const patched = patchDevLauncherToolbar(original);
  assert.doesNotMatch(patched, /axisBehavior\(/);
  assert.match(patched, /self/);
  assert.equal(patchDevLauncherToolbar(patched), patched);
  assert.throws(() => patchDevLauncherToolbar('upstream changed'), /changed/);
});

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// expo-dev-launcher 58.0.21 checks Swift 6.4, but Xcode 27.0 also ships that
// compiler without the referenced iOS 27.1 SwiftUI API. This is cosmetic dev UI.
const original = '#if os(iOS) && compiler(>=6.4)\n    if #available(iOS 27.1, *) {\n      axisBehavior(.verticalPreferred)\n    } else {\n      self\n    }\n#else\n    self\n#endif';
const compatible = '    self // HandyLANdy: optional toolbar axis omitted for Xcode 27.0 compatibility';

export function patchDevLauncherToolbar(source) {
  if (!source.includes(original) && !source.includes(compatible)) throw new Error('Expo development toolbar source changed; review the Xcode compatibility patch.');
  return source.replace(original, compatible);
}

async function main() {
  const path = fileURLToPath(new URL('../node_modules/expo-dev-launcher/ios/SwiftUI/Navigation/DevLauncherToolbar.swift', import.meta.url));
  const source = await readFile(path, 'utf8');
  const patched = patchDevLauncherToolbar(source);
  if (patched !== source) await writeFile(path, patched);
  console.log('Applied Expo development-toolbar compatibility patch.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from './ios.mjs';

export async function runSetup({
  runner = runCommand, platform = process.platform, nodeVersion = process.versions.node, cwd = process.cwd(),
} = {}) {
  if (platform !== 'darwin') throw new Error('Local iOS setup requires macOS. Use npm ci and npm run check for platform-independent checks.');
  const [major, minor] = nodeVersion.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 13)) throw new Error('Install Node.js 22.13 or newer, then run make setup again.');
  for (const [command, args, guidance] of [
    ['xcodebuild', ['-version'], 'Install Xcode, open it once, and select its developer directory with xcode-select.'],
    ['xcrun', ['--find', 'simctl'], 'Install the iOS Simulator tools through Xcode Settings > Components.'],
    ['xcrun', ['--find', 'xcdevice'], 'Select the full Xcode developer directory with xcode-select.'],
    ['pod', ['--version'], 'Install CocoaPods (tested with 1.16.2), then run make setup again.'],
  ]) {
    try { await runner(command, args, { cwd }); }
    catch (error) { throw Object.assign(new Error(`${guidance}\n${error.message}`), { exitCode: error.exitCode || 1 }); }
  }
  await runner('npm', ['ci'], { cwd });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runSetup().catch(error => { console.error(error.message); process.exitCode = error.exitCode || 1; });
}

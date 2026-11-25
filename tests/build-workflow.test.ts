import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCommand, parseOptions, runCommand, runWorkflow, selectDestination } from '../scripts/ios.mjs';

const simulators = [
  { name: 'iPhone 17', udid: 'PHONE-ID', state: 'Shutdown', isAvailable: true },
  { name: 'iPad Air', udid: 'PAD-ID', state: 'Booted', isAvailable: true },
  { name: 'Unavailable', udid: 'OLD-ID', state: 'Shutdown', isAvailable: false },
];
const devices = [
  { name: "Marc's iPhone", identifier: 'DEVICE-ID', simulator: false, platform: 'com.apple.platform.iphoneos', available: true },
  { name: 'Simulator', identifier: 'SIM-ID', simulator: true, available: true },
];

test('build defaults to Release and preserves a selector as one argument', () => {
  const selector = 'iPhone 17; $(touch /tmp/never-run)';
  assert.deepEqual(parseOptions(['build', 'simulator'], { SIMULATOR: selector }), {
    action: 'build', platform: 'simulator', selector, configuration: 'Release', team: undefined,
  });
  assert.equal(parseOptions(['run', 'device'], {}).configuration, 'Debug');
  assert.equal(parseOptions(['run', 'device'], { DEVICE: '  DEVICE-ID  ', CONFIGURATION: 'Release' }).selector, 'DEVICE-ID');
});

test('rejects unsupported actions, platforms and build settings before executing', () => {
  assert.throws(() => parseOptions(['clean', 'simulator'], {}), /Usage/);
  assert.throws(() => parseOptions(['run', 'android'], {}), /Usage/);
  assert.throws(() => parseOptions(['run', 'device', 'extra'], {}), /Usage/);
  assert.throws(() => parseOptions(['build', 'device'], { CONFIGURATION: 'Release; echo bad' }), /CONFIGURATION/);
  assert.throws(() => parseOptions(['build', 'device'], { DEVELOPMENT_TEAM: 'invalid' }), /DEVELOPMENT_TEAM/);
});

test('resolves shutdown simulators by exact name or UDID and prefers booted devices by default', () => {
  assert.equal(selectDestination('simulator', 'iPhone 17', simulators), 'PHONE-ID');
  assert.equal(selectDestination('simulator', 'PHONE-ID', simulators), 'PHONE-ID');
  assert.equal(selectDestination('simulator', undefined, simulators), 'PAD-ID');
  assert.throws(() => selectDestination('simulator', 'Unavailable', simulators), /No available/);
  assert.throws(() => selectDestination('simulator', 'iPhone', simulators), /No available/);
});

test('requires an unambiguous physical device and never picks a simulator', () => {
  assert.equal(selectDestination('device', undefined, devices), 'DEVICE-ID');
  assert.equal(selectDestination('device', "Marc's iPhone", devices), 'DEVICE-ID');
  assert.throws(() => selectDestination('device', 'SIM-ID', devices), /No available/);
  assert.throws(() => selectDestination('device', undefined, [...devices, { ...devices[0], identifier: 'TWO-ID' }]), /Multiple/);
  assert.throws(() => selectDestination('simulator', 'iPhone 17', [...simulators, { ...simulators[0], udid: 'TWO-ID' }]), /Multiple/);
});

test('simulator builds preserve Keychain entitlements with ad-hoc signing and predictable outputs', () => {
  const simulator = buildCommand(parseOptions(['build', 'simulator'], {}), '/project with spaces');
  assert.equal(simulator.command, 'xcodebuild');
  assert.ok(simulator.args.includes('generic/platform=iOS Simulator'));
  assert.ok(simulator.args.includes('/project with spaces/build/ios-simulator'));
  assert.ok(simulator.args.includes('CODE_SIGNING_ALLOWED=YES'));
  assert.ok(simulator.args.includes('CODE_SIGN_IDENTITY=-'));
  assert.ok(!simulator.args.includes('CODE_SIGNING_ALLOWED=NO'));
  assert.ok(!simulator.args.includes('--no-bundler'));
  const device = buildCommand(parseOptions(['build', 'device'], { DEVELOPMENT_TEAM: 'AB12CD34EF' }), '/project');
  assert.ok(device.args.includes('generic/platform=iOS'));
  assert.ok(device.args.includes('DEVELOPMENT_TEAM=AB12CD34EF'));
  assert.ok(!device.args.includes('CODE_SIGNING_ALLOWED=NO'));
  assert.ok(device.args.includes('-allowProvisioningUpdates'));
  assert.ok(!simulator.args.includes('-allowProvisioningUpdates'));
});

test('compile-only workflow prebuilds without cleaning, installs pods and never starts Metro or boots a simulator', async () => {
  const calls: { command: string; args: string[]; cwd: string }[] = [];
  const runner = async (command: string, args: string[], options: { cwd?: string } = {}) => {
    calls.push({ command, args, cwd: options.cwd! });
    return '';
  };
  await runWorkflow(parseOptions(['build', 'simulator'], {}), { runner, cwd: '/project with spaces' });
  assert.deepEqual(calls.map(call => call.command), ['npx', 'pod', 'xcodebuild']);
  assert.deepEqual(calls[0].args, ['--no-install', 'expo', 'prebuild', '--platform', 'ios', '--no-clean', '--no-install']);
  assert.equal(calls[1].cwd, '/project with spaces/ios');
  assert.deepEqual(calls[1].args, ['install']);
});

test('run workflow compiles a shutdown simulator app locally before passing its exact binary to Expo', async () => {
  const calls: { command: string; args: string[] }[] = [];
  const runner = async (command: string, args: string[]) => {
    calls.push({ command, args });
    return command === 'xcrun' ? JSON.stringify({ devices: { runtime: simulators } }) : '';
  };
  await runWorkflow(parseOptions(['run', 'simulator'], { SIMULATOR: 'iPhone 17' }), { runner, cwd: '/project' });
  const launch = calls.at(-1)!;
  assert.deepEqual(calls.map(call => call.command), ['npx', 'pod', 'xcrun', 'xcodebuild', 'npx']);
  assert.deepEqual(calls[3].args, buildCommand(parseOptions(['run', 'simulator'], {}), '/project', 'PHONE-ID').args);
  assert.equal(launch.command, 'npx');
  assert.deepEqual(launch.args, ['--no-install', 'expo', 'run:ios', '--no-install', '--configuration', 'Debug', '--device', 'PHONE-ID', '--binary', '/project/build/ios-simulator/Build/Products/Debug-iphonesimulator/HandyLANdy.app']);
});


for (const platform of ['simulator', 'device'] as const) {
  test(`run workflow launches the Release ${platform} binary from its shared local build directory`, async () => {
    const calls: { command: string; args: string[] }[] = [];
    const runner = async (command: string, args: string[]) => {
      calls.push({ command, args });
      if (command !== 'xcrun') return '';
      return JSON.stringify(platform === 'simulator' ? { devices: { runtime: simulators } } : devices);
    };
    const options = parseOptions(['run', platform], { CONFIGURATION: 'Release' });
    await runWorkflow(options, { runner, cwd: '/project with spaces' });
    const compilation = calls.find(call => call.command === 'xcodebuild');
    assert.ok(compilation);
    assert.ok(compilation.args.includes(`/project with spaces/build/ios-${platform}`));
    assert.ok(compilation.args.includes(platform === 'simulator' ? 'id=PAD-ID' : 'id=DEVICE-ID'));
    const launch = calls.at(-1)!;
    assert.equal(launch.command, 'npx');
    const binaryIndex = launch.args.indexOf('--binary');
    assert.ok(binaryIndex >= 0);
    assert.equal(launch.args[binaryIndex + 1], `/project with spaces/build/ios-${platform}/Build/Products/Release-${platform === 'simulator' ? 'iphonesimulator' : 'iphoneos'}/HandyLANdy.app`);
    assert.ok(!launch.args.includes('--output'));
    assert.ok(!launch.args.includes('--no-bundler'));
  });
}

for (const failingStage of ['compile', 'launch'] as const) {
  test(`run workflow propagates ${failingStage} failure and never continues after a failed build`, async () => {
    const failure = Object.assign(new Error(`${failingStage} failed`), { exitCode: failingStage === 'compile' ? 65 : 42 });
    const calls: { command: string; args: string[] }[] = [];
    const runner = async (command: string, args: string[]) => {
      calls.push({ command, args });
      if ((failingStage === 'compile' && command === 'xcodebuild') || (failingStage === 'launch' && args.includes('run:ios'))) throw failure;
      return command === 'xcrun' ? JSON.stringify({ devices: { runtime: simulators } }) : '';
    };
    await assert.rejects(runWorkflow(parseOptions(['run', 'simulator'], {}), { runner, cwd: '/project' }), (error: unknown) => error === failure);
    assert.equal(calls.at(-1)?.command, failingStage === 'compile' ? 'xcodebuild' : 'npx');
    assert.equal(calls.filter(call => call.args.includes('run:ios')).length, failingStage === 'compile' ? 0 : 1);
  });
}

test('workflow stops at a failed child and preserves its failure', async () => {
  const failure = Object.assign(new Error('pod install failed'), { exitCode: 31 });
  const commands: string[] = [];
  await assert.rejects(runWorkflow(parseOptions(['build', 'device'], {}), {
    cwd: '/project',
    runner: async (command: string) => { commands.push(command); if (command === 'pod') throw failure; return ''; },
  }), (error: unknown) => error === failure);
  assert.deepEqual(commands, ['npx', 'pod']);
});

test('runner propagates nonzero exit codes and keeps metacharacters literal', async () => {
  await assert.rejects(runCommand(process.execPath, ['-e', 'process.exit(17)'], { capture: true }), { exitCode: 17 });
  const literal = 'two words; $(echo injected) `echo injected`';
  const output = await runCommand(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', literal], { capture: true });
  assert.equal(output, literal);
});

test('setup checks existing local tools and installs locked npm dependencies without OS installers', async () => {
  const { runSetup } = await import('../scripts/setup.mjs');
  const commands: string[] = [];
  await runSetup({
    platform: 'darwin', nodeVersion: '22.21.1', cwd: '/project',
    runner: async (command: string) => { commands.push(command); return command === 'pod' ? '1.16.2\n' : ''; },
  });
  assert.deepEqual(commands, ['xcodebuild', 'xcrun', 'xcrun', 'pod', 'npm']);
});

test('setup fails with actionable prerequisites before installing dependencies', async () => {
  const { runSetup } = await import('../scripts/setup.mjs');
  await assert.rejects(runSetup({ platform: 'linux' }), /macOS/);
  await assert.rejects(runSetup({ platform: 'darwin', nodeVersion: '20.0.0' }), /Node/);
  await assert.rejects(runSetup({ platform: 'darwin', nodeVersion: '22.21.1', runner: async () => { throw new Error('not found'); } }), /Xcode/);
});

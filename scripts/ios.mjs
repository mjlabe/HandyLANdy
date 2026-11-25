import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const expo = ['--no-install', 'expo'];
const usage = 'Usage: node scripts/ios.mjs <run|build> <simulator|device>';

/** Resolve Make's exported variables without interpolating them into a shell.
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} env
 */
export function parseOptions(argv, env = process.env) {
  const [action, platform] = argv;
  if (argv.length !== 2 || !['run', 'build'].includes(action) || !['simulator', 'device'].includes(platform)) {
    throw new Error(usage);
  }
  const configuration = env.CONFIGURATION?.trim() || (action === 'build' ? 'Release' : 'Debug');
  if (!['Debug', 'Release'].includes(configuration)) throw new Error('CONFIGURATION must be Debug or Release.');
  const team = env.DEVELOPMENT_TEAM?.trim() || undefined;
  if (team && !/^[A-Z0-9]{10}$/.test(team)) throw new Error('DEVELOPMENT_TEAM must be a 10-character Apple team ID.');
  return {
    action, platform,
    selector: env[platform === 'simulator' ? 'SIMULATOR' : 'DEVICE']?.trim() || undefined,
    configuration, team,
  };
}

/** Pick only available destinations of the requested kind; exact matches avoid surprises. */
export function selectDestination(platform, selector, destinations) {
  const candidates = destinations.filter(item => platform === 'simulator'
    ? item.isAvailable !== false && item.udid
    : !item.simulator && item.platform === 'com.apple.platform.iphoneos' && item.available !== false && !item.error);
  const matches = selector
    ? candidates.filter(item => item.udid === selector || item.identifier === selector || item.name === selector)
    : candidates;
  if (!matches.length) throw new Error(`No available ${platform}${selector ? ` matching ${JSON.stringify(selector)}` : ''}. Check Xcode Devices and Simulators.`);
  if (platform === 'simulator' && !selector) {
    return (matches.find(item => item.state === 'Booted') || matches.find(item => item.name.startsWith('iPhone')) || matches[0]).udid;
  }
  if (matches.length > 1) throw new Error(`Multiple ${platform} destinations match. Set ${platform === 'simulator' ? 'SIMULATOR' : 'DEVICE'} to a UDID.`);
  return matches[0].udid || matches[0].identifier;
}

/** Compile without booting a simulator, installing an app, or starting Metro. */
export function buildCommand(options, cwd, destinationId) {
  const destination = destinationId ? `id=${destinationId}` : `generic/platform=${options.platform === 'simulator' ? 'iOS Simulator' : 'iOS'}`;
  return {
    command: 'xcodebuild',
    args: [
      '-workspace', resolve(cwd, 'ios/HandyLANdy.xcworkspace'),
      '-scheme', 'HandyLANdy', '-configuration', options.configuration,
      '-sdk', options.platform === 'simulator' ? 'iphonesimulator' : 'iphoneos',
      '-destination', destination,
      '-derivedDataPath', resolve(cwd, `build/ios-${options.platform}`),
      // Simulator Keychain access needs signed entitlements. Ad-hoc signing
      // needs no Apple account and preserves those entitlements for SecureStore.
      ...(options.platform === 'simulator' ? ['CODE_SIGNING_ALLOWED=YES', 'CODE_SIGN_IDENTITY=-'] : []),
      ...(options.platform === 'device' ? ['-allowProvisioningUpdates'] : []),
      ...(options.team && options.platform === 'device' ? [`DEVELOPMENT_TEAM=${options.team}`] : []),
      'build',
    ],
  };
}

/** Spawn directly, preserving paths, selectors, exit codes, and signals.
 * @param {string} command
 * @param {string[]} args
 * @param {{cwd?: string, capture?: boolean, env?: NodeJS.ProcessEnv}} options
 * @returns {Promise<string>}
 */
export function runCommand(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      shell: false,
      stdio: options.capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    });
    let stdout = '';
    let stderr = '';
    if (options.capture) {
      child.stdout.on('data', data => { stdout += data; });
      child.stderr.on('data', data => { stderr += data; });
    }
    child.on('error', error => reject(Object.assign(error, { exitCode: 1 })));
    child.on('close', (code, signal) => {
      if (code === 0) resolvePromise(stdout);
      else reject(Object.assign(new Error(`${command} ${signal ? `was terminated by ${signal}` : `failed (exit ${code})`}.${stderr ? `\n${stderr.trim()}` : ''}`), {
        exitCode: code || (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1), signal,
      }));
    });
  });
}

function appBinaryPath(options, cwd = process.cwd()) {
  return resolve(cwd, `build/ios-${options.platform}/Build/Products/${options.configuration}-${options.platform === 'simulator' ? 'iphonesimulator' : 'iphoneos'}/HandyLANdy.app`);
}

export async function runWorkflow(options, { runner = runCommand, cwd = process.cwd() } = {}) {
  if (process.platform !== 'darwin' && runner === runCommand) throw new Error('Local iOS builds require macOS and Xcode.');
  await runner('npx', [...expo, 'prebuild', '--platform', 'ios', '--no-clean', '--no-install'], { cwd });
  await runner('pod', ['install'], { cwd: resolve(cwd, 'ios') });
  let destinationId;
  if (options.action === 'run' || options.selector) {
    if (options.platform === 'simulator') {
      const listing = JSON.parse(await runner('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], { cwd, capture: true }));
      destinationId = selectDestination('simulator', options.selector, Object.values(listing.devices).flat());
    } else {
      const listing = JSON.parse(await runner('xcrun', ['xcdevice', 'list'], { cwd, capture: true }));
      destinationId = selectDestination('device', options.selector, listing);
    }
  }
  const command = buildCommand(options, cwd, destinationId);
  await runner(command.command, command.args, { cwd });
  if (options.action === 'run') {
    await runner('npx', [...expo, 'run:ios', '--no-install', '--configuration', options.configuration,
      '--device', destinationId, '--binary', appBinaryPath(options, cwd)], { cwd });
  }
}

async function main() {
  try {
    const options = parseOptions(process.argv.slice(2));
    await runWorkflow(options);
    if (options.action === 'build') {
      console.log(`Built app: ${appBinaryPath(options)}`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = error.exitCode || 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main();

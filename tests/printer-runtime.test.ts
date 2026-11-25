import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureMqttRuntime, type MqttRuntimeProcess } from '../src/printer/runtime';

test('provides the asynchronous nextTick API missing from React Native process', async () => {
  const runtime: MqttRuntimeProcess & { env: { NODE_ENV: string } } = { env: { NODE_ENV: 'development' } };
  ensureMqttRuntime(runtime);
  const calls: string[] = [];
  const done = new Promise<void>(resolve => runtime.nextTick!((value) => { calls.push(String(value)); resolve(); }, 'packet uncorked'));
  assert.deepEqual(calls, []);
  await done;
  assert.deepEqual(calls, ['packet uncorked']);
  assert.equal(runtime.env.NODE_ENV, 'development');
});

test('preserves an existing scheduler instead of replacing the application process', () => {
  const existing = () => {};
  const runtime = { nextTick: existing };
  ensureMqttRuntime(runtime);
  assert.equal(runtime.nextTick, existing);
});

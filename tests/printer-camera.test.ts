import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createJpegCameraCore } from '../src/printer/jpeg-camera-core';
import { createTlsDuplex } from '../src/printer/tls-duplex';
import type { PrinterProfile } from '../src/printer/types';

const profile: PrinterProfile = {
  id: 'one',
  name: 'Printer',
  host: 'printer.local',
  serial: 'SERIAL001',
  model: 'P1S',
  trustSelfSigned: true,
  cameraProtocol: 'jpeg',
};
class Socket extends EventEmitter {
  destroyed = false;
  writes: Uint8Array[] = [];
  timeout = 0;
  paused = false;
  write(data: Uint8Array, _encoding?: string, callback?: (error?: Error) => void) {
    this.writes.push(data);
    callback?.();
    return true;
  }
  destroy() {
    this.destroyed = true;
    return this;
  }
  setTimeout(ms: number) {
    this.timeout = ms;
    return this;
  }
  pause() {
    this.paused = true;
    return this;
  }
  resume() {
    this.paused = false;
    return this;
  }
}

test('JPEG camera authenticates after TLS, emits complete frame, and ignores late events after stop', () => {
  const socket = new Socket();
  const frames: string[] = [];
  const errors: string[] = [];
  const camera = createJpegCameraCore(
    () => socket,
    (frame) => frames.push(frame),
    (error) => errors.push(error),
  );
  camera.start(profile, '12345678');
  assert.equal(socket.writes.length, 0);
  socket.emit('secureConnect');
  assert.equal(socket.writes[0].length, 80);
  const frame = Buffer.alloc(20);
  frame.writeUInt32LE(4);
  frame.set([255, 216, 255, 217], 16);
  socket.emit('data', frame.subarray(0, 18));
  assert.equal(frames.length, 0);
  socket.emit('data', frame.subarray(18));
  assert.equal(frames[0], 'data:image/jpeg;base64,/9j/2Q==');
  camera.stop();
  socket.emit('data', frame);
  socket.emit('error', new Error('12345678'));
  assert.equal(frames.length, 1);
  assert.equal(errors.length, 0);
  assert.equal(socket.destroyed, true);
  assert.equal(socket.timeout, 0);
});

test('JPEG socket timeout tears down and reports only a safe actionable error', () => {
  const socket = new Socket();
  const errors: string[] = [];
  const camera = createJpegCameraCore(
    () => socket,
    () => assert.fail(),
    (error) => errors.push(error),
  );
  camera.start(profile, '12345678');
  socket.emit('timeout');
  socket.emit('close');
  assert.equal(socket.destroyed, true);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /timed out/i);
});

test('JPEG parser error tears down the camera socket', () => {
  const socket = new Socket();
  const errors: string[] = [];
  const camera = createJpegCameraCore(
    () => socket,
    () => assert.fail(),
    (error) => errors.push(error),
  );
  camera.start(profile, '12345678');
  socket.emit('secureConnect');
  socket.emit('data', Buffer.alloc(16));
  assert.equal(socket.destroyed, true);
  assert.match(errors[0], /frame/i);
});

test('TLS Duplex delays MQTT writes until secureConnect and closes the native socket', async () => {
  const socket = new Socket();
  const stream = createTlsDuplex(socket);
  let written = false;
  stream.write(Buffer.from([0x10, 0]), () => {
    written = true;
  });
  assert.equal(socket.writes.length, 0);
  socket.emit('secureConnect');
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(socket.writes.length, 1);
  assert.equal(written, true);
  const chunks: Uint8Array[] = [];
  stream.on('data', (chunk) => chunks.push(chunk));
  socket.emit('data', Buffer.from([0x20, 2, 0, 0]));
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual([...Buffer.concat(chunks)], [0x20, 2, 0, 0]);
  stream.destroy();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(socket.destroyed, true);
});

for (const [error, expected] of [
  ['The certificate chain for this server is invalid. secret=12345678', /certificate/i],
  ['Connection refused secret=12345678', /refused/i],
  [Object.assign(new Error('secret=12345678'), { code: 'EHOSTUNREACH' }), /unreachable/i],
] as const) {
  test(`TLS adapter preserves a safe ${expected.source} diagnosis`, async () => {
    const socket = new Socket();
    const stream = createTlsDuplex(socket);
    const errors: Error[] = [];
    stream.on('error', (error) => errors.push(error));
    socket.emit('error', error);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(socket.destroyed, true);
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, expected);
    assert.doesNotMatch(errors[0].message, /12345678/);
  });
}

test('TLS adapter batches corked MQTT fragments into one native write', async () => {
  const socket = new Socket();
  const stream = createTlsDuplex(socket);
  const completed: number[] = [];
  stream.on('error', (error) => assert.fail(error.message));
  stream.cork();
  stream.write(Uint8Array.of(0x10), () => completed.push(1));
  stream.write(Uint8Array.of(2), () => completed.push(2));
  stream.write(Uint8Array.of(0, 0), () => completed.push(3));
  stream.uncork();
  assert.equal(socket.writes.length, 0, 'no part of CONNECT may be sent before TLS is ready');
  socket.emit('secureConnect');
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(
    socket.writes.length,
    1,
    'one MQTT packet should cross the native bridge as one write',
  );
  assert.deepEqual([...socket.writes[0]], [0x10, 2, 0, 0]);
  assert.deepEqual(completed, [1, 2, 3]);
  stream.destroy();
});

test('destroy before TLS readiness fails every queued packet fragment', async () => {
  const socket = new Socket();
  const stream = createTlsDuplex(socket);
  const failures: (Error | null | undefined)[] = [];
  stream.on('error', () => {});
  stream.cork();
  stream.write(Uint8Array.of(0x10), (error) => failures.push(error));
  stream.write(Uint8Array.of(2, 0, 0), (error) => failures.push(error));
  stream.uncork();
  stream.destroy();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(failures.length, 2);
  assert.ok(failures.every((error) => error instanceof Error));
  assert.equal(socket.writes.length, 0);
  assert.equal(socket.destroyed, true);
});

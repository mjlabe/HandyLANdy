import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createRequire } from 'node:module';
import { generate, parser, type Packet } from 'mqtt-packet';
import { createMqttTransport } from '../src/printer/mqtt-transport';
import ClientImplementation from 'mqtt/lib/client';
import type { MqttClient as ClientConstructor } from 'mqtt';
import type { PrinterProfile } from '../src/printer/types';

const profile: PrinterProfile = { id: 'one', name: 'Printer', host: 'printer.local', serial: 'SERIAL001', model: 'P1S', trustSelfSigned: true, cameraProtocol: 'jpeg' };
class BrokerSocket extends EventEmitter {
  destroyed = false;
  broker = parser();
  packets: Packet[] = [];
  rejectSubscription = false;
  constructor() {
    super();
    this.broker.on('packet', (packet) => {
      this.packets.push(packet);
      if (packet.cmd === 'connect') queueMicrotask(() => this.emit('data', generate({ cmd: 'connack', returnCode: 0, sessionPresent: false })));
      if (packet.cmd === 'subscribe') queueMicrotask(() => this.emit('data', generate({ cmd: 'suback', messageId: packet.messageId, granted: [this.rejectSubscription ? 128 : 0] })));
    });
  }
  write(data: Uint8Array, _encoding?: string, callback?: (error?: Error) => void) { this.broker.parse(Buffer.from(data)); callback?.(); return true; }
  setTimeout() { return this; }
  pause() { return this; }
  resume() { return this; }
  destroy() { this.destroyed = true; return this; }
}

test('real MQTT.js client authenticates over injected TLS stream and waits for SUBACK', async () => {
  const socket = new BrokerSocket();
  let connected!: () => void;
  const ready = new Promise<void>((resolve) => { connected = resolve; });
  const messages: string[] = [];
  const transport = createMqttTransport(profile, '12345678', { connected, message: (_topic, value) => messages.push(value), closed() {}, error(error) { assert.fail(String(error)); } }, () => socket);
  assert.equal(socket.packets.length, 0);
  socket.emit('secureConnect');
  await ready;
  const packet = socket.packets[0];
  assert.equal(packet.cmd, 'connect');
  if (packet.cmd === 'connect') { assert.equal(packet.username, 'bblp'); assert.equal(packet.password?.toString(), '12345678'); }
  await new Promise<void>((resolve, reject) => transport.subscribe('device/SERIAL001/report', (error) => error ? reject(error) : resolve()));
  transport.publish('device/SERIAL001/request', '{"pushing":{"command":"pushall"}}');
  socket.emit('data', generate({ cmd: 'publish', topic: 'device/SERIAL001/report', payload: '{"print":{"mc_percent":0}}', qos: 0, dup: false, retain: false }));
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(messages, ['{"print":{"mc_percent":0}}']);
  transport.close();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(socket.destroyed, true);
});

test('MQTT subscription failure is propagated when printer rejects the topic', async () => {
  const socket = new BrokerSocket(); socket.rejectSubscription = true;
  let connected!: () => void;
  const ready = new Promise<void>((resolve) => { connected = resolve; });
  const transport = createMqttTransport(profile, '12345678', { connected, message() {}, closed() {}, error() {} }, () => socket);
  socket.emit('secureConnect'); await ready;
  const error = await new Promise<Error | undefined>((resolve) => transport.subscribe('device/SERIAL001/report', resolve));
  assert.ok(error);
  transport.close();
});

test('MQTT diagnostics stay disabled even when dependency debugging is enabled', () => {
  const debug = createRequire(import.meta.url)('debug') as { enable(value: string): void; disable(): string; log: (...args: unknown[]) => void };
  const originalLog = debug.log;
  const logs: unknown[][] = [];
  debug.log = (...args) => { logs.push(args); };
  debug.enable('mqttjs:*');
  try {
    const socket = new BrokerSocket();
    const transport = createMqttTransport(profile, '12345678', { connected() {}, message() {}, error() {}, closed() {} }, () => socket);
    transport.close();
    assert.equal(logs.length, 0, 'MQTT logs can contain CONNECT credentials');
  } finally { debug.disable(); debug.log = originalLog; }
});

test('MQTT packet serializer diagnostics cannot print the LAN access code', () => {
  const debug = createRequire(import.meta.url)('debug') as { enable(value: string): void; disable(): string; log: (...args: unknown[]) => void };
  const originalLog = debug.log;
  const logs: unknown[][] = [];
  debug.log = (...args) => { logs.push(args); };
  debug.enable('mqtt-packet:writeToStream');
  try {
    const socket = new BrokerSocket();
    const transport = createMqttTransport(profile, '12345678', { connected() {}, message() {}, error() {}, closed() {} }, () => socket);
    transport.close();
    assert.equal(JSON.stringify(logs).includes('12345678'), false);
  } finally { debug.disable(); debug.log = originalLog; }
});

test('MQTT initialization releases the raw socket when TLS event registration throws', async () => {
  class BrokenSocket extends BrokerSocket {
    override on(event: string | symbol, listener: Parameters<EventEmitter['on']>[1]) {
      if (event === 'data') throw new Error('native registration failed for password=12345678');
      return super.on(event, listener);
    }
  }
  const socket = new BrokenSocket();
  let callbacks = 0;
  const event = () => { callbacks++; };
  assert.throws(() => createMqttTransport(profile, '12345678', { connected: event, message: event, error: event, closed: event }, () => socket), (error: Error) => !error.message.includes('12345678'));
  assert.equal(socket.destroyed, true);
  assert.equal(socket.listenerCount('secureConnect'), 0);
  assert.equal(socket.listenerCount('data'), 0);
  socket.emit('secureConnect'); socket.emit('close'); socket.emit('error', new Error('late native error'));
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(callbacks, 0);
  assert.equal(socket.packets.length, 0);
});

test('MQTT initialization closes its client and stream when startup throws after scheduling a timeout', async (t) => {
  const MqttClient = ClientImplementation as unknown as typeof ClientConstructor;
  const originalConnect = MqttClient.prototype.connect;
  const setTimeoutOriginal = globalThis.setTimeout;
  const clearTimeoutOriginal = globalThis.clearTimeout;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  t.mock.method(globalThis, 'setTimeout', ((callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
    const timer = setTimeoutOriginal(callback, delay, ...args);
    timers.add(timer);
    return timer;
  }) as typeof setTimeout);
  t.mock.method(globalThis, 'clearTimeout', (timer: ReturnType<typeof setTimeout>) => { timers.delete(timer); clearTimeoutOriginal(timer); });
  t.mock.method(MqttClient.prototype, 'connect', function (this: InstanceType<typeof ClientConstructor>) {
    originalConnect.call(this);
    throw new Error('MQTT startup failed for password=12345678');
  });
  const socket = new BrokerSocket();
  let callbacks = 0;
  const event = () => { callbacks++; };
  try {
    assert.throws(() => createMqttTransport(profile, '12345678', { connected: event, message: event, error: event, closed: event }, () => socket), (error: Error) => !error.message.includes('12345678'));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(socket.destroyed, true);
    assert.equal(timers.size, 0, 'failed startup must clear its MQTT connection timeout');
    assert.equal(socket.listenerCount('secureConnect'), 0);
    assert.equal(socket.listenerCount('data'), 0);
    socket.emit('secureConnect'); socket.emit('close'); socket.emit('error', new Error('late native error'));
    assert.equal(callbacks, 0);
  } finally { for (const timer of timers) clearTimeoutOriginal(timer); }
});

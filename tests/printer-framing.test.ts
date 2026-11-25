import assert from 'node:assert/strict';
import test from 'node:test';
import { MqttPacketGate, MAX_MQTT_PACKET_BYTES } from '../src/printer/mqtt-framing';

function header(length: number) {
  const result = [0x30];
  do {
    const digit = length % 128;
    length = Math.floor(length / 128);
    result.push(digit | (length ? 128 : 0));
  } while (length);
  return Uint8Array.from(result);
}

test('forwards fragmented and coalesced MQTT packets after checking their headers', () => {
  const chunks: Uint8Array[] = [];
  const gate = new MqttPacketGate(chunk => chunks.push(chunk.slice()));
  const packets = Uint8Array.from([0x20, 2, 0, 0, 0xd0, 0, 0x30, 3, 1, 2, 3]);
  gate.push(packets.subarray(0, 1));
  assert.equal(chunks.length, 0, 'unchecked header must not reach MQTT.js');
  gate.push(packets.subarray(1, 3));
  gate.push(packets.subarray(3));
  assert.deepEqual(Buffer.concat(chunks), Buffer.from(packets));
  assert.equal(gate.bufferedBytes, 0);
});

test('rejects advertised oversized packets before accepting any body bytes', () => {
  const chunks: Uint8Array[] = [];
  const gate = new MqttPacketGate(chunk => chunks.push(chunk));
  const oversized = header(MAX_MQTT_PACKET_BYTES);
  for (const byte of oversized.subarray(0, -1)) gate.push(Uint8Array.of(byte));
  assert.equal(chunks.length, 0);
  assert.throws(() => gate.push(oversized.subarray(-1)), /packet size/i);
  assert.equal(chunks.length, 0);
  assert.equal(gate.bufferedBytes, 0);
});

test('bounds state without retaining full valid MQTT packet bodies', () => {
  let forwarded = 0;
  const gate = new MqttPacketGate(chunk => { forwarded += chunk.length; });
  const bodyLength = MAX_MQTT_PACKET_BYTES - 4;
  gate.push(header(bodyLength));
  for (let index = 0; index < bodyLength; index += 4096) {
    const chunk = new Uint8Array(Math.min(4096, bodyLength - index));
    gate.push(chunk);
    assert.equal(gate.bufferedBytes, 0);
  }
  assert.equal(forwarded, MAX_MQTT_PACKET_BYTES);
});

test('rejects malformed MQTT remaining-length encodings and stays failed', () => {
  for (const bytes of [[0x30, 0xff, 0xff, 0xff, 0xff], [0x30, 0x80, 0]]) {
    let forwarded = 0;
    const gate = new MqttPacketGate(chunk => { forwarded += chunk.length; });
    assert.throws(() => gate.push(Uint8Array.from(bytes)), /length/i);
    gate.push(Uint8Array.of(0xd0, 0));
    assert.equal(forwarded, 0);
    assert.equal(gate.bufferedBytes, 0);
  }
});

test('TLS Duplex closes on oversized MQTT header before forwarding it downstream', async () => {
  const { EventEmitter } = await import('node:events');
  const { createTlsDuplex } = await import('../src/printer/tls-duplex');
  class Socket extends EventEmitter {
    destroyed = false;
    write() { return true; }
    pause() {}
    resume() {}
    setTimeout() {}
    destroy() { this.destroyed = true; }
  }
  const socket = new Socket();
  const stream = createTlsDuplex(socket);
  const data: unknown[] = [];
  const errors: Error[] = [];
  stream.on('data', value => data.push(value));
  stream.on('error', error => errors.push(error));
  socket.emit('data', header(MAX_MQTT_PACKET_BYTES));
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(socket.destroyed, true);
  assert.equal(data.length, 0);
  assert.match(errors[0]?.message ?? '', /packet size/i);
});

test('TLS Duplex settles an outstanding pre-handshake write when destroyed', async () => {
  const { EventEmitter } = await import('node:events');
  const { createTlsDuplex } = await import('../src/printer/tls-duplex');
  class Socket extends EventEmitter {
    write() { return true; }
    pause() {}
    resume() {}
    setTimeout() {}
    destroy() {}
  }
  const stream = createTlsDuplex(new Socket());
  let writeError: Error | null | undefined;
  stream.on('error', () => {});
  stream.write(Uint8Array.of(0x10, 0), error => { writeError = error; });
  stream.destroy();
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.ok(writeError, 'destroy must fail the pending write callback');
});

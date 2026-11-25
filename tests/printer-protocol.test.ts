import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeReport } from '../src/printer/normalize';
import { validateProfile } from '../src/printer/validation';
import { createCameraAuth, JpegFrameParser, MAX_FRAME_BYTES } from '../src/printer/jpeg-parser';

const profile = { name: 'Workshop', host: '192.168.1.20', serial: '01P00A123456789', model: 'P1S', cameraProtocol: 'jpeg' as const, trustSelfSigned: true };

test('partial reports preserve absent readings and accept zero values', () => {
  const first = normalizeReport({}, JSON.stringify({ print: { nozzle_temper: 210, bed_temper: 60, mc_percent: 45, subtask_name: 'Bracket' } }), 10)!;
  const next = normalizeReport(first, { print: { nozzle_temper: 0, mc_percent: 0, cooling_fan_speed: '0' } }, 20)!;
  assert.equal(next.nozzleTemperature, 0);
  assert.equal(next.progress, 0);
  assert.equal(next.partFan, 0);
  assert.equal(next.bedTemperature, 60);
  assert.equal(next.jobName, 'Bracket');
  assert.equal(next.lastReportAt, 20);
  assert.equal(first.nozzleTemperature, 210);
});

test('nested AMS deltas merge units and trays by identity', () => {
  const first = normalizeReport({}, { print: { ams: { ams: [{ id: '0', humidity: '3', temp: 25, tray: [{ id: '0', tray_type: 'PLA', tray_color: 'FF0000FF', remain: 90 }, { id: '1', tray_type: 'PETG' }] }, { id: '1', tray: [{ id: '0', tray_type: 'ABS' }] }] } } })!;
  const next = normalizeReport(first, { print: { ams: { ams: [{ id: '0', humidity: '0', tray: [{ id: '0', remain: 0 }] }] } } })!;
  assert.equal(next.ams?.[0].humidity, 0);
  assert.equal(next.ams?.[0].temperature, 25);
  assert.deepEqual(next.ams?.[0].trays[0], { id: '0', material: 'PLA', color: '#FF0000', remaining: 0 });
  assert.equal(next.ams?.[0].trays[1].material, 'PETG');
  assert.equal(next.ams?.[1].trays[0].material, 'ABS');
});

test('malformed reports do not fabricate fresh readings', () => {
  for (const payload of ['{', 'null', '[]', '{}', { print: null }, { print: { mc_percent: false } }, { print: { mc_percent: 'NaN' } }]) {
    assert.equal(normalizeReport({ progress: 50 }, payload), null);
  }
  assert.equal(normalizeReport({}, { print: { mc_percent: 101 } }), null);
});

test('profile validation rejects URLs, invalid IPv4, MQTT topic wildcards, and missing credentials', () => {
  assert.deepEqual(validateProfile(profile, '12345678'), {});
  assert.deepEqual(validateProfile({ ...profile, host: 'printer.local' }, '12345678'), {});
  assert.ok(validateProfile({ ...profile, host: 'https://printer.local' }, '12345678').host);
  assert.ok(validateProfile({ ...profile, host: '999.168.1.20' }, '12345678').host);
  assert.ok(validateProfile({ ...profile, serial: 'bad/+/serial' }, '12345678').serial);
  assert.ok(validateProfile({ ...profile, name: '' }, '').name);
  assert.ok(validateProfile(profile, '').accessCode);
});

function frame(jpeg: Uint8Array) {
  const result = Buffer.alloc(16 + jpeg.length);
  result.writeUInt32LE(jpeg.length, 0);
  result.set(jpeg, 16);
  return result;
}

test('JPEG parser handles fragmented headers, bodies and multiple frames', () => {
  const frames: Uint8Array[] = [];
  const parser = new JpegFrameParser((jpeg) => frames.push(jpeg));
  const jpeg = Uint8Array.from([255, 216, 1, 2, 255, 217]);
  const bytes = Buffer.concat([frame(jpeg), frame(jpeg)]);
  for (const byte of bytes) parser.push(Uint8Array.of(byte));
  assert.deepEqual(frames, [jpeg, jpeg]);
  assert.equal(parser.bufferedBytes, 0);
});

test('JPEG parser bounds allocation and rejects invalid signatures', () => {
  for (const length of [0, 1, MAX_FRAME_BYTES + 1, 0xffffffff]) {
    const parser = new JpegFrameParser(() => assert.fail('invalid frame emitted'));
    const header = Buffer.alloc(16);
    header.writeUInt32LE(length);
    assert.throws(() => parser.push(header), /frame length/i);
    assert.equal(parser.bufferedBytes, 0);
  }
  const parser = new JpegFrameParser(() => assert.fail('invalid JPEG emitted'));
  assert.throws(() => parser.push(frame(Uint8Array.of(0, 1, 2, 3))), /JPEG/i);
  parser.reset();
  assert.equal(parser.bufferedBytes, 0);
});

test('camera auth has fixed fields and bounded credentials', () => {
  const auth = createCameraAuth('12345678');
  assert.equal(auth.length, 80);
  assert.equal(auth[0], 0x40);
  assert.equal(auth[5], 0x30);
  assert.equal(Buffer.from(auth.subarray(16, 20)).toString(), 'bblp');
  assert.equal(Buffer.from(auth.subarray(48, 56)).toString(), '12345678');
  assert.throws(() => createCameraAuth('x'.repeat(33)), /access code/i);
});

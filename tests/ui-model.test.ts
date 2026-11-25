import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDuration, formatTemperature, isStatusStale } from '../src/utils/format';
import { createRtspsSource } from '../src/camera/source';

test('formats unavailable values separately from real zero readings', () => {
  assert.equal(formatTemperature(undefined), '—');
  assert.equal(formatTemperature(0), '0°');
  assert.equal(formatDuration(undefined), '—');
  assert.equal(formatDuration(0), '0 min');
  assert.equal(formatDuration(125), '2h 5m');
});

test('marks old or missing printer reports stale', () => {
  assert.equal(isStatusStale(undefined, 40_000), true);
  assert.equal(isStatusStale(1_000, 30_999), false);
  assert.equal(isStatusStale(1_000, 31_000), true);
});

test('builds a credential-escaped RTSPS source with per-printer certificate choice', () => {
  const source = createRtspsSource('192.168.1.42', 'A@:/ #?%', false);
  assert.equal(source.uri, 'rtsps://bblp:A%40%3A%2F%20%23%3F%25@192.168.1.42:322/streaming/live/1');
  assert.equal(source.acceptInvalidCertificates, false);
  assert.ok(source.initOptions.includes('--rtsp-tcp'));
  assert.equal(createRtspsSource('printer.local', '12345678', true).acceptInvalidCertificates, true);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSessionCore,
  type SessionTransport,
  type TransportEvents,
} from '../src/printer/session-core';
import type { PrinterProfile, SessionSnapshot } from '../src/printer/types';

const profile: PrinterProfile = {
  id: 'one',
  name: 'Printer',
  host: 'printer.local',
  serial: 'SERIAL001',
  model: 'P1S',
  trustSelfSigned: true,
  cameraProtocol: 'jpeg',
};
function harness() {
  let clock = 0;
  let nextTimer = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const connections: {
    events: TransportEvents;
    transport: SessionTransport;
    closed: boolean;
    subscriptions: string[];
    requests: { topic: string; payload: string }[];
    ack?: (error?: Error) => void;
  }[] = [];
  const session = createSessionCore({
    now: () => clock,
    setTimer(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, { at: clock + delay, callback });
      return id;
    },
    clearTimer(id) {
      timers.delete(id as number);
    },
    createTransport(_profile, _code, events) {
      const connection = {
        events,
        closed: false,
        subscriptions: [] as string[],
        requests: [] as { topic: string; payload: string }[],
        ack: undefined as ((error?: Error) => void) | undefined,
        transport: {} as SessionTransport,
      };
      connection.transport = {
        subscribe(topic, callback) {
          connection.subscriptions.push(topic);
          connection.ack = callback;
        },
        publish(topic, payload, callback) {
          connection.requests.push({ topic, payload });
          callback?.();
        },
        close() {
          connection.closed = true;
        },
      };
      connections.push(connection);
      return connection.transport;
    },
  });
  let snapshot: SessionSnapshot = { connection: 'disconnected', status: {} };
  session.subscribe((value) => {
    snapshot = value;
  });
  function advance(ms: number) {
    clock += ms;
    for (const [id, timer] of [...timers])
      if (timer.at <= clock) {
        timers.delete(id);
        timer.callback();
      }
  }
  return { session, connections, timers, advance, snapshot: () => snapshot };
}

test('session requests pushall and version only after subscription acknowledgement', () => {
  const h = harness();
  h.session.start(profile, '12345678');
  const c = h.connections[0];
  c.events.connected();
  assert.deepEqual(c.subscriptions, ['device/SERIAL001/report']);
  assert.equal(c.requests.length, 0);
  c.ack?.();
  assert.equal(h.snapshot().connection, 'connected');
  assert.deepEqual(
    c.requests.map((r) => JSON.parse(r.payload)),
    [
      { pushing: { sequence_id: '1', command: 'pushall' } },
      { info: { sequence_id: '2', command: 'get_version' } },
    ],
  );
  assert.ok(c.requests.every((r) => r.topic === 'device/SERIAL001/request'));
  h.session.stop();
});

test('switching printers isolates late messages, subscription callbacks and reconnects', () => {
  const h = harness();
  h.session.start(profile, '12345678');
  const old = h.connections[0];
  old.events.connected();
  h.session.start({ ...profile, id: 'two', serial: 'SERIAL002' }, '87654321');
  old.ack?.();
  old.events.message('device/SERIAL001/report', '{"print":{"mc_percent":99}}');
  old.events.closed();
  assert.equal(old.closed, true);
  assert.equal(old.requests.length, 0);
  assert.equal(h.snapshot().status.progress, undefined);
  h.advance(60000);
  assert.equal(h.connections.length, 2);
  h.session.stop();
});

test('stop cancels pending reconnect and ignores callbacks from disposed attempts', () => {
  const h = harness();
  h.session.start(profile, '12345678');
  h.connections[0].events.closed();
  assert.equal(h.snapshot().connection, 'reconnecting');
  h.session.stop();
  h.advance(60000);
  h.connections[0].events.connected();
  assert.equal(h.connections.length, 1);
  assert.equal(h.timers.size, 0);
  assert.equal(h.snapshot().connection, 'disconnected');
});

test('report timeout reconnects with bounded retries and no raw errors or credentials', () => {
  const h = harness();
  h.session.start(profile, '12345678');
  for (let i = 0; i < 6; i++) {
    const c = h.connections[i];
    assert.ok(c);
    c.events.connected();
    c.ack?.();
    h.advance(15000);
    if (i < 5) {
      assert.equal(h.snapshot().connection, 'reconnecting');
      h.advance(15000);
    }
  }
  assert.equal(h.snapshot().connection, 'failed');
  assert.equal(h.connections.length, 6);
  assert.equal(h.timers.size, 0);
  assert.ok(!h.snapshot().error?.includes('12345678'));
});

test('valid report cancels request timeout; malformed messages leave timestamp untouched', () => {
  const h = harness();
  h.session.start(profile, '12345678');
  const c = h.connections[0];
  c.events.connected();
  c.ack?.();
  c.events.message('device/SERIAL001/report', '{');
  assert.equal(h.snapshot().status.lastReportAt, undefined);
  c.events.message('device/OTHER/report', '{"print":{"mc_percent":99}}');
  assert.equal(h.snapshot().status.lastReportAt, undefined);
  c.events.message('device/SERIAL001/report', '{"print":{"mc_percent":0}}');
  h.advance(20000);
  assert.equal(h.snapshot().connection, 'connected');
  assert.equal(h.snapshot().status.progress, 0);
  assert.equal(h.timers.size, 0);
  h.session.stop();
});

test('raw native errors never expose the access code and invalid profiles never connect', () => {
  const h = harness();
  h.session.start({ ...profile, serial: 'bad/+/topic' }, '12345678');
  assert.equal(h.connections.length, 0);
  assert.equal(h.snapshot().connection, 'failed');
  h.session.start(profile, '12345678');
  h.connections[0].events.error(new Error('Failed for password=12345678'));
  assert.equal(h.snapshot().connection, 'reconnecting');
  assert.equal(h.snapshot().error?.includes('12345678'), false);
  h.session.stop();
});

test('certificate failures identify the trust setting without exposing native details', () => {
  const h = harness();
  h.session.start(profile, '12345678');
  h.connections[0].events.error(
    Object.assign(new Error('secret=12345678'), { code: 'SELF_SIGNED_CERT_IN_CHAIN' }),
  );
  assert.match(h.snapshot().error ?? '', /certificate/i);
  assert.match(h.snapshot().error ?? '', /self-signed/i);
  assert.equal(h.snapshot().error?.includes('12345678'), false);
  h.session.stop();
});

test('missing status after MQTT login points to the serial number', () => {
  const h = harness();
  h.session.start(profile, '12345678');
  h.connections[0].events.connected();
  h.connections[0].ack?.();
  h.advance(15000);
  assert.match(h.snapshot().error ?? '', /no.*status/i);
  assert.match(h.snapshot().error ?? '', /serial number/i);
  h.session.stop();
});

test('connection timeout is distinct from a missing status report', () => {
  const h = harness();
  h.session.start(profile, '12345678');
  h.advance(15000);
  assert.match(h.snapshot().error ?? '', /connecting.*8883/i);
  assert.doesNotMatch(h.snapshot().error ?? '', /serial number/i);
  h.session.stop();
});

for (const [code, expected] of [
  ['ECONNREFUSED', /refused.*8883/i],
  ['EHOSTUNREACH', /unreachable/i],
  [5, /authentication/i],
] as const) {
  test(`connection error ${code} reports a specific cause without native text`, () => {
    const h = harness();
    h.session.start(profile, '12345678');
    h.connections[0].events.error(Object.assign(new Error('secret=12345678'), { code }));
    assert.match(h.snapshot().error ?? '', expected);
    assert.doesNotMatch(h.snapshot().error ?? '', /12345678/);
    h.session.stop();
  });
}

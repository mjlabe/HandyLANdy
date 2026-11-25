import assert from 'node:assert/strict';
import test from 'node:test';
import { createPrinterController } from '../src/state/controller';
import type { PrinterProfile, PrinterSession, SessionSnapshot } from '../src/printer/types';
import type { ProfileRepository } from '../src/storage/profiles';

const one: PrinterProfile = { id: 'one', name: 'One', host: 'one.local', serial: 'SERIAL001', model: 'P1S', cameraProtocol: 'jpeg', trustSelfSigned: true };
const two: PrinterProfile = { ...one, id: 'two', name: 'Two', host: 'two.local', serial: 'SERIAL002' };
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function flush() { await new Promise<void>((resolve) => setImmediate(resolve)); }
function harness() {
  let profiles = [one, two];
  const reads: { id: string; pending: ReturnType<typeof deferred<string | null>> }[] = [];
  const sessions: { starts: { profile: PrinterProfile; code: string }[]; stopped: boolean; emit(next: SessionSnapshot): void }[] = [];
  const repository: ProfileRepository = {
    async load() { return profiles; },
    async save(profile) { profiles = profiles.some((item) => item.id === profile.id) ? profiles.map((item) => item.id === profile.id ? profile : item) : [...profiles, profile]; },
    async remove(id) { profiles = profiles.filter((item) => item.id !== id); },
    getAccessCode(id) { const pending = deferred<string | null>(); reads.push({ id, pending }); return pending.promise; },
  };
  const controller = createPrinterController({ repository, now: () => 1000, createSession() {
    const listeners = new Set<(next: SessionSnapshot) => void>();
    const session = { starts: [] as { profile: PrinterProfile; code: string }[], stopped: false, emit(next: SessionSnapshot) { listeners.forEach((listener) => listener(next)); } };
    sessions.push(session);
    const result: PrinterSession = {
      start(profile, code) { session.starts.push({ profile, code }); session.emit({ connection: 'connected', status: { progress: 42 } }); },
      stop() { session.stopped = true; session.emit({ connection: 'disconnected', status: {} }); },
      subscribe(listener) { listeners.add(listener); listener({ connection: 'disconnected', status: {} }); return () => { listeners.delete(listener); }; },
    };
    return result;
  } });
  return { controller, repository, reads, sessions };
}

test('loading chooses first saved printer and snapshots remain stable between events', async () => {
  const h = harness(); await h.controller.start();
  const snapshot = h.controller.getSnapshot();
  assert.equal(snapshot.profile?.id, one.id);
  assert.equal(snapshot.loading, false);
  assert.equal(snapshot, h.controller.getSnapshot());
  assert.deepEqual(h.reads.map((read) => read.id), ['one']);
  h.controller.dispose();
});

test('switch clears old credentials and status atomically before exposing a new profile', async () => {
  const h = harness(); await h.controller.start();
  h.reads[0].pending.resolve('old-secret'); await flush();
  assert.equal(h.controller.getSnapshot().accessCode, 'old-secret');
  const observed: ReturnType<typeof h.controller.getSnapshot>[] = [];
  h.controller.subscribe(() => observed.push(h.controller.getSnapshot()));
  h.controller.select(two.id);
  assert.equal(h.sessions[0].stopped, true);
  assert.ok(observed.length);
  for (const state of observed) if (state.profile?.id === two.id) { assert.equal(state.accessCode, undefined); assert.deepEqual(state.snapshot.status, {}); }
  h.sessions[0].emit({ connection: 'connected', status: { progress: 99 } });
  assert.equal(h.controller.getSnapshot().snapshot.status.progress, undefined);
  h.controller.dispose();
});

for (const action of ['switch', 'background', 'disconnect', 'dispose'] as const) {
  test(`late credential lookup after ${action} never opens an obsolete session`, async () => {
    const h = harness(); await h.controller.start();
    if (action === 'switch') h.controller.select(two.id);
    if (action === 'background') h.controller.setForeground(false);
    if (action === 'disconnect') h.controller.disconnect();
    if (action === 'dispose') h.controller.dispose();
    h.reads[0].pending.resolve('old-secret'); await flush();
    assert.equal(h.sessions.length, 0);
    assert.equal(h.controller.getSnapshot().accessCode, undefined);
    h.controller.dispose();
  });
}

test('foreground refreshes status and credentials; manual disconnect remains disabled', async () => {
  const h = harness(); await h.controller.start();
  h.reads[0].pending.resolve('secret'); await flush();
  h.controller.setForeground(false);
  assert.equal(h.sessions[0].stopped, true);
  assert.deepEqual(h.controller.getSnapshot().snapshot.status, {});
  h.controller.setForeground(true);
  assert.equal(h.reads.length, 2);
  h.reads[1].pending.resolve('fresh-secret'); await flush();
  assert.equal(h.sessions[1].starts[0].code, 'fresh-secret');
  h.controller.disconnect(); h.controller.setForeground(false); h.controller.setForeground(true);
  assert.equal(h.reads.length, 2);
  h.controller.dispose();
});

test('demo stops live session and clock updates only demo snapshot timestamps', async () => {
  const h = harness(); await h.controller.start();
  h.reads[0].pending.resolve('secret'); await flush();
  h.controller.showDemo();
  assert.equal(h.sessions[0].stopped, true);
  const snapshot = h.controller.getSnapshot();
  assert.equal(snapshot.demo, true); assert.equal(snapshot.profile?.id, 'demo'); assert.equal(snapshot.accessCode, undefined);
  h.controller.tick(2000);
  assert.equal(h.controller.getSnapshot().snapshot.status.lastReportAt, 2000);
  h.controller.exitDemo();
  assert.equal(h.controller.getSnapshot().demo, false);
  assert.equal(h.controller.getSnapshot().profile?.id, one.id);
  h.controller.dispose();
});

test('save and removal failures preserve selected profile, credentials and readings', async () => {
  const h = harness(); await h.controller.start(); h.reads[0].pending.resolve('secret'); await flush();
  const before = h.controller.getSnapshot();
  h.repository.save = async () => { throw new Error('password=secret'); };
  await assert.rejects(h.controller.saveProfile({ ...one, name: 'Renamed' }, 'other'), (error: Error) => !error.message.includes('secret'));
  assert.equal(h.controller.getSnapshot(), before);
  h.repository.remove = async () => { throw new Error('password=secret'); };
  await assert.rejects(h.controller.removeProfile(one.id), (error: Error) => !error.message.includes('secret'));
  assert.equal(h.controller.getSnapshot(), before);
  h.controller.dispose();
});

test('mutations serialize and publish saved profiles only after repository mutation succeeds', async () => {
  const h = harness(); await h.controller.start();
  const pending = deferred<void>(); const operations: string[] = [];
  h.repository.save = async () => { operations.push('save'); await pending.promise; };
  h.repository.remove = async () => { operations.push('remove'); };
  const saving = h.controller.saveProfile(one, 'secret');
  const removing = h.controller.removeProfile(two.id);
  await flush(); assert.deepEqual(operations, ['save']);
  pending.resolve(); await Promise.all([saving, removing]);
  assert.deepEqual(operations, ['save', 'remove']);
  h.controller.dispose();
});

test('load failure preserves saved state, retry preserves selection, and disposal blocks mutation commits', async () => {
  const h = harness(); await h.controller.start(); h.controller.select(two.id);
  const originalLoad = h.repository.load;
  h.repository.load = async () => { throw new Error('private storage value'); };
  await h.controller.reload();
  assert.equal(h.controller.getSnapshot().profile?.id, two.id);
  assert.ok(h.controller.getSnapshot().loadError);
  assert.equal(h.controller.getSnapshot().loadError?.includes('private'), false);
  h.repository.load = originalLoad; await h.controller.reload();
  assert.equal(h.controller.getSnapshot().profile?.id, two.id);
  const pending = deferred<void>(); h.repository.save = () => pending.promise;
  const saving = h.controller.saveProfile({ ...one, name: 'Changed' }, 'secret'); await flush();
  h.controller.dispose(); const disposed = h.controller.getSnapshot();
  pending.resolve(); await saving;
  assert.equal(h.controller.getSnapshot(), disposed);
});

test('demo remains accessible after saved profiles fail to load', async () => {
  const h = harness();
  h.repository.load = async () => { throw new Error('storage unavailable'); };
  await h.controller.start();
  assert.ok(h.controller.getSnapshot().loadError);
  h.controller.showDemo();
  const snapshot = h.controller.getSnapshot();
  assert.equal(snapshot.demo, true);
  assert.equal(snapshot.loading, false);
  assert.equal(snapshot.loadError, undefined);
  assert.equal(snapshot.profile?.id, 'demo');
  assert.deepEqual(snapshot.profiles, []);
  h.controller.exitDemo();
  assert.ok(h.controller.getSnapshot().loadError, 'leaving demo restores the saved profile recovery flow');
  h.controller.dispose();
});

test('successful save updates profiles and selection without a redundant storage reload', async () => {
  const h = harness(); await h.controller.start();
  const three = { ...one, id: 'three', name: 'Three' };
  h.repository.load = async () => { throw new Error('reload unavailable'); };
  await h.controller.saveProfile(three, 'secret');
  let snapshot = h.controller.getSnapshot();
  assert.deepEqual(snapshot.profiles.map((profile) => profile.id), ['one', 'two', 'three']);
  assert.equal(snapshot.profile?.id, 'three');
  await h.controller.saveProfile({ ...three, name: 'Renamed' }, 'secret');
  snapshot = h.controller.getSnapshot();
  assert.equal(snapshot.profiles.length, 3);
  assert.equal(snapshot.profile?.name, 'Renamed');
  h.controller.dispose();
});

test('successful removal stops the deleted active printer without a redundant storage reload', async () => {
  const h = harness(); await h.controller.start();
  h.reads[0].pending.resolve('secret'); await flush();
  h.repository.load = async () => { throw new Error('reload unavailable'); };
  await h.controller.removeProfile(one.id);
  assert.equal(h.sessions[0].stopped, true);
  const snapshot = h.controller.getSnapshot();
  assert.deepEqual(snapshot.profiles.map((profile) => profile.id), ['two']);
  assert.equal(snapshot.profile?.id, 'two');
  assert.equal(snapshot.accessCode, undefined);
  assert.deepEqual(snapshot.snapshot.status, {});
  await h.controller.removeProfile(two.id);
  assert.equal(h.controller.getSnapshot().profile, undefined);
  assert.equal(h.controller.getSnapshot().profiles.length, 0);
  h.controller.dispose();
});

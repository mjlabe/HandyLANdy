import assert from 'node:assert/strict';
import test from 'node:test';
import { createProfileRepository, CredentialStorageUnavailableError } from '../src/storage/profiles';
import type { PrinterProfile } from '../src/printer/types';

const profile: PrinterProfile = {
  id: 'printer/a ☃', name: 'Workshop', host: '192.168.1.20', serial: 'SERIAL',
  model: 'P1S', cameraProtocol: 'rtsps', trustSelfSigned: true,
};

class MemoryStore {
  values = new Map<string, string>();
  failNextSet = false;
  failNextRemove = false;
  failAfterNextSet = false;
  failAfterNextRemove = false;
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) {
    if (this.failNextSet) { this.failNextSet = false; throw new Error('write failed'); }
    this.values.set(key, value);
    if (this.failAfterNextSet) { this.failAfterNextSet = false; throw new Error('write failed after commit'); }
  }
  async removeItem(key: string) {
    if (this.failNextRemove) { this.failNextRemove = false; throw new Error('delete failed'); }
    this.values.delete(key);
    if (this.failAfterNextRemove) { this.failAfterNextRemove = false; throw new Error('delete failed after commit'); }
  }
}
function setup() {
  const metadata = new MemoryStore();
  const secrets = new MemoryStore();
  return { metadata, secrets, repository: createProfileRepository(metadata, secrets) };
}

test('stores only canonical nonsecret profile fields in metadata and uses credential-safe keys', async () => {
  const { metadata, secrets, repository } = setup();
  await repository.save({ ...profile, accessCode: 'secret-code', password: 'secret-code' } as PrinterProfile, 'secret-code');
  assert.deepEqual(await repository.load(), [profile]);
  assert.equal(await repository.getAccessCode(profile.id), 'secret-code');
  assert.equal([...metadata.values.values()].some(value => value.includes('secret-code')), false);
  assert.deepEqual(JSON.parse([...metadata.values.values()][0]), [profile]);
  assert.match([...secrets.values.keys()][0], /^[A-Za-z0-9._-]+$/);
});

test('restores the previous credential and profile when metadata save fails', async () => {
  const { metadata, repository } = setup();
  await repository.save(profile, 'old-secret');
  metadata.failAfterNextSet = true;
  await assert.rejects(repository.save({ ...profile, name: 'Changed' }, 'new-secret'), /save/i);
  assert.deepEqual(await repository.load(), [profile]);
  assert.equal(await repository.getAccessCode(profile.id), 'old-secret');
});

test('rolls back a new credential when first metadata save fails', async () => {
  const { metadata, secrets, repository } = setup();
  metadata.failNextSet = true;
  await assert.rejects(repository.save(profile, 'new-secret'), /save/i);
  assert.deepEqual(await repository.load(), []);
  assert.equal(secrets.values.size, 0);
});

test('restores credentials when a secret write fails after changing storage', async () => {
  const { secrets, repository } = setup();
  await repository.save(profile, 'old-secret');
  secrets.failAfterNextSet = true;
  await assert.rejects(repository.save({ ...profile, name: 'Changed' }, 'new-secret'), /save/i);
  assert.deepEqual(await repository.load(), [profile]);
  assert.equal(await repository.getAccessCode(profile.id), 'old-secret');
});

test('preserves both stores when credential deletion fails', async () => {
  const { secrets, repository } = setup();
  await repository.save(profile, 'old-secret');
  secrets.failAfterNextRemove = true;
  await assert.rejects(repository.remove(profile.id), /remove/i);
  assert.deepEqual(await repository.load(), [profile]);
  assert.equal(await repository.getAccessCode(profile.id), 'old-secret');
});

test('restores deleted credential and metadata when metadata deletion fails', async () => {
  const { metadata, repository } = setup();
  await repository.save(profile, 'old-secret');
  metadata.failAfterNextSet = true;
  await assert.rejects(repository.remove(profile.id), /remove/i);
  assert.deepEqual(await repository.load(), [profile]);
  assert.equal(await repository.getAccessCode(profile.id), 'old-secret');
});

test('removes profile and access code together', async () => {
  const { repository } = setup();
  await repository.save(profile, 'secret');
  await repository.remove(profile.id);
  assert.deepEqual(await repository.load(), []);
  assert.equal(await repository.getAccessCode(profile.id), null);
});

test('serializes concurrent mutations without losing profiles and reads wait for writes', async () => {
  const { repository } = setup();
  const second = { ...profile, id: 'second', name: 'Office' };
  const saving = Promise.all([repository.save(profile, 'one'), repository.save(second, 'two')]);
  const loading = repository.load();
  await saving;
  assert.deepEqual(await loading, [profile, second]);
  await Promise.all([repository.remove(profile.id), repository.save({ ...second, name: 'Edited' }, 'three')]);
  assert.deepEqual(await repository.load(), [{ ...second, name: 'Edited' }]);
});

test('reports corrupt metadata and never overwrites it during a failed save', async () => {
  for (const raw of ['{broken', '{}', '[null]', JSON.stringify([{ ...profile, trustSelfSigned: 'yes' }]), JSON.stringify([profile, profile])]) {
    const { metadata, secrets, repository } = setup();
    await repository.save(profile, 'old-secret');
    const key = [...metadata.values.keys()][0];
    metadata.values.set(key, raw);
    await assert.rejects(repository.load(), /stored printer profiles/i);
    await assert.rejects(repository.save(profile, 'new-secret'), /stored printer profiles/i);
    assert.equal(metadata.values.get(key), raw);
    assert.equal([...secrets.values.values()][0], 'old-secret');
  }
});

test('strips unknown fields when loading existing metadata', async () => {
  const { metadata, repository } = setup();
  await repository.save(profile, 'secret');
  metadata.values.set([...metadata.values.keys()][0], JSON.stringify([{ ...profile, password: 'legacy-value' }]));
  assert.deepEqual(await repository.load(), [profile]);
});

test('validates input before writing and keeps the queue usable after failure', async () => {
  const { metadata, secrets, repository } = setup();
  await assert.rejects(repository.save({ ...profile, id: '' }, 'secret'), /profile/i);
  await assert.rejects(repository.save(profile, ''), /access code/i);
  assert.equal(metadata.values.size, 0);
  assert.equal(secrets.values.size, 0);
  await repository.save(profile, 'secret');
  assert.deepEqual(await repository.load(), [profile]);
});

test('surfaces recovery failure without exposing credentials or provider error text', async () => {
  const metadata = new MemoryStore();
  const secrets = new MemoryStore();
  const repository = createProfileRepository(metadata, secrets);
  await repository.save(profile, 'old-secret');
  metadata.setItem = async () => { throw new Error('old-secret new-secret'); };
  await assert.rejects(repository.save(profile, 'new-secret'), (error: unknown) => {
    assert.match(String(error), /recover|restore/i);
    assert.doesNotMatch(String(error), /old-secret|new-secret/);
    return true;
  });
});


test('refuses unsupported credential storage before changing any metadata', async () => {
  const metadata = new MemoryStore();
  const unavailable = async (): Promise<never> => { throw new CredentialStorageUnavailableError(); };
  const repository = createProfileRepository(metadata, {
    getItem: unavailable, setItem: unavailable, removeItem: unavailable,
  });
  await assert.rejects(repository.save(profile, 'browser-secret'), /iOS or Android secure credential storage/);
  assert.deepEqual(await repository.load(), []);
  assert.equal(metadata.values.size, 0);
});

test('sanitizes credential provider read failures and leaves metadata intact', async () => {
  const { metadata, secrets, repository } = setup();
  await repository.save(profile, 'secret-code');
  secrets.getItem = async () => { throw new Error('provider echoed secret-code'); };
  await assert.rejects(repository.getAccessCode(profile.id), (error: unknown) => {
    assert.match(String(error), /secure storage/i);
    assert.doesNotMatch(String(error), /secret-code/);
    return true;
  });
  assert.equal(metadata.values.size, 1);
  assert.deepEqual(await repository.load(), [profile]);
});

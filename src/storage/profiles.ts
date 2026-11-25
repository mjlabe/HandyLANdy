import type { PrinterProfile } from '../printer/types';

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface ProfileRepository {
  load(): Promise<PrinterProfile[]>;
  save(profile: PrinterProfile, accessCode: string): Promise<void>;
  remove(id: string): Promise<void>;
  getAccessCode(id: string): Promise<string | null>;
}

export class ProfileStorageError extends Error {
  constructor(message: string, readonly code: 'invalid-profile' | 'corrupt-metadata' | 'storage-failed' | 'recovery-failed' | 'credentials-unavailable') {
    super(message);
    this.name = 'ProfileStorageError';
  }
}

export class CredentialStorageUnavailableError extends ProfileStorageError {
  constructor() {
    super('Saving real printers requires iOS or Android secure credential storage. Use demo mode in the browser.', 'credentials-unavailable');
  }
}

const METADATA_KEY = 'handylandy.printer-profiles.v1';
const validString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

function validateId(id: unknown): asserts id is string {
  if (!validString(id) || id.length > 128) {
    throw new ProfileStorageError('Printer profile ID must contain 1–128 characters.', 'invalid-profile');
  }
}

function canonicalProfile(value: unknown): PrinterProfile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ProfileStorageError('Printer profile is invalid.', 'invalid-profile');
  }
  const item = value as Record<string, unknown>;
  validateId(item.id);
  if (!validString(item.name) || !validString(item.host) || !validString(item.serial) || !validString(item.model)
    || (item.cameraProtocol !== 'rtsps' && item.cameraProtocol !== 'jpeg') || typeof item.trustSelfSigned !== 'boolean') {
    throw new ProfileStorageError('Printer profile has invalid or missing fields.', 'invalid-profile');
  }
  // Pick fields explicitly: callers and legacy JSON may contain sensitive extras.
  return {
    id: item.id, name: item.name, host: item.host, serial: item.serial, model: item.model,
    cameraProtocol: item.cameraProtocol, trustSelfSigned: item.trustSelfSigned,
  };
}

function parseProfiles(raw: string | null): PrinterProfile[] {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error();
    const profiles = parsed.map(canonicalProfile);
    if (new Set(profiles.map(profile => profile.id)).size !== profiles.length) throw new Error();
    return profiles;
  } catch {
    // Do not clear corrupt data or put its potentially sensitive contents in errors.
    throw new ProfileStorageError('Stored printer profiles could not be read. Stored data was preserved; restore a valid backup or reset app storage to recover.', 'corrupt-metadata');
  }
}

function credentialKey(id: string): string {
  validateId(id);
  // Fixed-width UTF-16 encoding is injective and uses only SecureStore-safe characters.
  let encoded = '';
  for (let index = 0; index < id.length; index++) encoded += id.charCodeAt(index).toString(16).padStart(4, '0');
  return `handylandy.access.${encoded}`;
}

/** One repository instance serializes reads and writes to avoid partial reads/lost updates.
 * Stores cannot share a transaction: rollback handles rejected writes (including ones
 * that changed data), but OS termination and persistent rollback failures need recovery.
 */
export function createProfileRepository(metadataStore: KeyValueStore, secretStore: KeyValueStore): ProfileRepository {
  let pending: Promise<unknown> = Promise.resolve();
  function serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(operation);
    pending = result.catch(() => undefined);
    return result;
  }

  async function readMetadata() {
    let raw: string | null;
    try {
      raw = await metadataStore.getItem(METADATA_KEY);
    } catch {
      throw new ProfileStorageError('Could not read stored printer profiles. Try again.', 'storage-failed');
    }
    return { raw, profiles: parseProfiles(raw) };
  }

  async function readCredential(key: string) {
    try {
      return await secretStore.getItem(key);
    } catch (error) {
      if (error instanceof CredentialStorageUnavailableError) throw error;
      throw new ProfileStorageError('Could not read the printer access code from secure storage. Try again.', 'storage-failed');
    }
  }

  async function restore(store: KeyValueStore, key: string, previous: string | null) {
    if (previous === null) await store.removeItem(key);
    else await store.setItem(key, previous);
  }

  async function mutate(id: string, operation: 'save' | 'remove', profile?: PrinterProfile, accessCode?: string) {
    const key = credentialKey(id);
    const { raw, profiles } = await readMetadata();
    const previousSecret = await readCredential(key);
    const nextProfiles = operation === 'remove'
      ? profiles.filter(item => item.id !== id)
      : profiles.some(item => item.id === id)
        ? profiles.map(item => item.id === id ? profile! : item)
        : [...profiles, profile!];
    let metadataAttempted = false;
    try {
      if (operation === 'save') await secretStore.setItem(key, accessCode!);
      else await secretStore.removeItem(key);
      metadataAttempted = true;
      await metadataStore.setItem(METADATA_KEY, JSON.stringify(nextProfiles));
    } catch {
      // Attempt both restores even if one fails; never expose storage-provider text.
      const recovery = [restore(secretStore, key, previousSecret)];
      if (metadataAttempted) recovery.push(restore(metadataStore, METADATA_KEY, raw));
      const results = await Promise.allSettled(recovery);
      if (results.some(result => result.status === 'rejected')) {
        throw new ProfileStorageError(`Could not ${operation} printer profile or fully restore its previous storage. Retry the operation to recover.`, 'recovery-failed');
      }
      throw new ProfileStorageError(`Could not ${operation} printer profile. Previous values were restored; try again.`, 'storage-failed');
    }
  }

  return {
    load: () => serialized(async () => (await readMetadata()).profiles),
    async save(profile, accessCode) {
      const safeProfile = canonicalProfile(profile);
      if (!validString(accessCode)) throw new ProfileStorageError('Printer access code is required.', 'invalid-profile');
      return serialized(() => mutate(safeProfile.id, 'save', safeProfile, accessCode));
    },
    async remove(id) {
      validateId(id);
      return serialized(() => mutate(id, 'remove'));
    },
    async getAccessCode(id) {
      const key = credentialKey(id);
      return serialized(() => readCredential(key));
    },
  };
}

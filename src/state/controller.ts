import type { PrinterProfile, PrinterSession, SessionSnapshot } from '../printer/types';
import type { ProfileRepository } from '../storage/profiles';
import { demoProfile, demoStatus } from './demo';

interface PrinterActions {
  reload(): Promise<void>;
  select(id: string): void;
  showDemo(): void;
  exitDemo(): void;
  reconnect(): void;
  disconnect(): void;
  saveProfile(profile: PrinterProfile, accessCode: string): Promise<void>;
  removeProfile(id: string): Promise<void>;
}
export interface PrinterState extends PrinterActions {
  profiles: PrinterProfile[];
  profile?: PrinterProfile;
  demo: boolean;
  now: number;
  loading: boolean;
  loadError?: string;
  accessCode?: string;
  foreground: boolean;
  enabled: boolean;
  snapshot: SessionSnapshot;
}
interface ControllerDependencies {
  repository: ProfileRepository;
  createSession(): PrinterSession;
  now?: () => number;
  initialForeground?: boolean;
}
interface ControllerData {
  profiles: PrinterProfile[];
  selectedId?: string;
  demo: boolean;
  now: number;
  loading: boolean;
  loadError?: string;
  accessCode?: string;
  foreground: boolean;
  enabled: boolean;
  snapshot: SessionSnapshot;
}
const disconnected = (): SessionSnapshot => ({ connection: 'disconnected', status: {} });
const LOAD_ERROR = 'Saved printers could not be loaded. Your saved data has not been cleared. Try again.';

/** External store owns cancellation and atomic selection; React only subscribes to it. */
export function createPrinterController({ repository, createSession, now = Date.now, initialForeground = true }: ControllerDependencies) {
  let active = false;
  let lifecycle = 0;
  let connection = 0;
  let loadGeneration = 0;
  let session: PrinterSession | undefined;
  let unsubscribeSession: (() => void) | undefined;
  let pending: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  let data: ControllerData = { profiles: [], demo: false, now: now(), loading: true, foreground: initialForeground, enabled: true, snapshot: disconnected() };
  let snapshot: PrinterState;
  const buildSnapshot = (): PrinterState => ({
    profiles: data.profiles,
    profile: data.demo ? demoProfile : data.profiles.find((item) => item.id === data.selectedId),
    // Preserve storage failures internally so leaving demo still offers recovery.
    demo: data.demo, now: data.now, loading: data.demo ? false : data.loading, loadError: data.demo ? undefined : data.loadError,
    accessCode: data.accessCode, foreground: data.foreground, enabled: data.enabled,
    snapshot: data.demo ? { connection: 'connected', status: demoStatus(data.now) } : data.snapshot,
    ...actions,
  });
  function publish(patch: Partial<ControllerData>) {
    data = { ...data, ...patch };
    snapshot = buildSnapshot();
    listeners.forEach((listener) => listener());
  }
  function cancelConnection() {
    connection++;
    unsubscribeSession?.(); unsubscribeSession = undefined;
    const previous = session; session = undefined;
    previous?.stop();
  }
  function reconfigure(patch: Partial<ControllerData>) {
    if (!active) return;
    cancelConnection();
    const expected = connection;
    const expectedLifecycle = lifecycle;
    const next = { ...data, ...patch };
    const profile = next.profiles.find((item) => item.id === next.selectedId);
    const shouldConnect = !!profile && !next.demo && next.foreground && next.enabled;
    // One publication changes identity and removes every previous connection value.
    publish({ ...patch, accessCode: undefined, snapshot: shouldConnect ? { connection: 'connecting', status: {} } : disconnected() });
    const current = () => active && lifecycle === expectedLifecycle && connection === expected;
    if (!profile || !shouldConnect || !current()) return;
    void repository.getAccessCode(profile.id).then((code) => {
      if (!current()) return;
      if (!code) {
        publish({ snapshot: { connection: 'failed', status: {}, error: 'The saved access code is unavailable. Edit this printer and enter it again.' } });
        return;
      }
      try {
        const nextSession = createSession();
        session = nextSession;
        let started = false;
        unsubscribeSession = nextSession.subscribe((value) => { if (current() && started) publish({ snapshot: value }); });
        publish({ accessCode: code });
        if (!current()) return;
        started = true;
        nextSession.start(profile, code);
      } catch {
        if (!current()) return;
        cancelConnection();
        publish({ accessCode: undefined, snapshot: { connection: 'failed', status: {}, error: 'The printer connection could not start. Try reconnecting from a native development build.' } });
      }
    }).catch(() => {
      if (current()) publish({ snapshot: { connection: 'failed', status: {}, error: 'The access code could not be read from secure storage. Unlock your device and try again.' } });
    });
  }
  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(operation);
    pending = result.catch(() => undefined);
    return result;
  }
  function selectedFrom(profiles: PrinterProfile[], preferred = data.selectedId) {
    return profiles.some((item) => item.id === preferred) ? preferred : profiles[0]?.id;
  }
  const actions: PrinterActions = {
    async reload() {
      if (!active) return;
      const expectedLifecycle = lifecycle;
      const expectedLoad = ++loadGeneration;
      const current = () => active && lifecycle === expectedLifecycle && loadGeneration === expectedLoad;
      publish({ loading: true, loadError: undefined });
      await serialize(async () => {
        if (!current()) return;
        try {
          const profiles = await repository.load();
          if (current()) reconfigure({ profiles, selectedId: selectedFrom(profiles), loading: false, loadError: undefined });
        } catch { if (current()) publish({ loading: false, loadError: LOAD_ERROR }); }
      });
    },
    select(id) { if (data.profiles.some((item) => item.id === id)) reconfigure({ selectedId: id, demo: false, enabled: true }); },
    showDemo() { reconfigure({ demo: true, enabled: false }); },
    exitDemo() { reconfigure({ demo: false, enabled: true }); },
    reconnect() { reconfigure({ enabled: true }); },
    disconnect() { reconfigure({ enabled: false }); },
    async saveProfile(profile, accessCode) {
      const expectedLifecycle = lifecycle;
      const savedProfile: PrinterProfile = {
        id: profile.id, name: profile.name, host: profile.host, serial: profile.serial,
        model: profile.model, cameraProtocol: profile.cameraProtocol, trustSelfSigned: profile.trustSelfSigned,
      };
      await serialize(async () => {
        if (!active || lifecycle !== expectedLifecycle) return;
        try {
          await repository.save(savedProfile, accessCode);
        } catch { throw new Error('This printer could not be saved securely. Your previous selection has been preserved. Unlock the device and try again.'); }
        if (!active || lifecycle !== expectedLifecycle) return;
        const profiles = data.profiles.some((item) => item.id === savedProfile.id)
          ? data.profiles.map((item) => item.id === savedProfile.id ? savedProfile : item)
          : [...data.profiles, savedProfile];
        reconfigure({ profiles, selectedId: savedProfile.id, demo: false, enabled: true, loading: false, loadError: undefined });
      });
    },
    async removeProfile(id) {
      const expectedLifecycle = lifecycle;
      await serialize(async () => {
        if (!active || lifecycle !== expectedLifecycle) return;
        try {
          await repository.remove(id);
        } catch { throw new Error('The printer could not be removed. Your previous selection has been preserved. Try again.'); }
        if (!active || lifecycle !== expectedLifecycle) return;
        const profiles = data.profiles.filter((item) => item.id !== id);
        reconfigure({ profiles, selectedId: selectedFrom(profiles), loading: false, loadError: undefined });
      });
    },
  };
  snapshot = buildSnapshot();
  return {
    ...actions,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async start() {
      if (active) return;
      active = true; lifecycle++;
      await actions.reload();
    },
    dispose() {
      if (!active) return;
      active = false; lifecycle++; loadGeneration++;
      cancelConnection();
      publish({ accessCode: undefined, snapshot: disconnected() });
    },
    setForeground(foreground: boolean) { if (data.foreground !== foreground) reconfigure({ foreground, now: now() }); },
    tick(time = now()) { if (active && data.foreground && time !== data.now) publish({ now: time }); },
  };
}

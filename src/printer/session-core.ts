import { normalizeReport } from './normalize';
import { validateProfile } from './validation';
import type { PrinterProfile, PrinterSession, SessionSnapshot } from './types';

export interface TransportEvents {
  connected(): void;
  message(topic: string, payload: string): void;
  closed(): void;
  error(error?: unknown): void;
}
export interface SessionTransport {
  subscribe(topic: string, callback: (error?: Error) => void): void;
  publish(topic: string, payload: string, callback?: (error?: Error) => void): void;
  close(): void;
}
interface SessionDependencies {
  createTransport(profile: PrinterProfile, accessCode: string, events: TransportEvents): SessionTransport;
  now?: () => number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 15000];
const CONNECTION_HELP = 'Connection failed. Check the printer address, LAN access code, local network permission, and certificate trust setting.';

/** Foreground owner must call stop() when hidden/backgrounded; all work is cancellable. */
export function createSessionCore(dependencies: SessionDependencies): PrinterSession {
  const setTimer = dependencies.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
  const clearTimer = dependencies.clearTimer ?? ((timer) => clearTimeout(timer as ReturnType<typeof setTimeout>));
  const listeners = new Set<(snapshot: SessionSnapshot) => void>();
  let snapshot: SessionSnapshot = { connection: 'disconnected', status: {} };
  let generation = 0;
  let transport: SessionTransport | undefined;
  let timer: unknown;
  let profile: PrinterProfile | undefined;
  let accessCode = '';
  let retries = 0;
  const emit = (next: SessionSnapshot) => { snapshot = next; for (const listener of listeners) listener(snapshot); };
  const cancelTimer = () => { if (timer !== undefined) clearTimer(timer); timer = undefined; };
  const dispose = () => {
    generation++;
    cancelTimer();
    const old = transport; transport = undefined;
    old?.close();
  };
  const fail = (message: string, expectedGeneration: number) => {
    if (generation !== expectedGeneration) return;
    dispose();
    if (retries >= RETRY_DELAYS.length) {
      accessCode = '';
      emit({ ...snapshot, connection: 'failed', error: message });
      return;
    }
    const delay = RETRY_DELAYS[retries++];
    const retryGeneration = generation;
    emit({ ...snapshot, connection: 'reconnecting', error: message });
    timer = setTimer(() => { timer = undefined; if (generation === retryGeneration) connect(); }, delay);
  };
  const connect = () => {
    if (!profile) return;
    const current = ++generation;
    const reportTopic = `device/${profile.serial.trim()}/report`;
    const requestTopic = `device/${profile.serial.trim()}/request`;
    timer = setTimer(() => fail('Printer timed out. Check that it is online and LAN access is enabled.', current), 15000);
    try {
      transport = dependencies.createTransport(profile, accessCode, {
        connected() {
          if (generation !== current) return;
          transport?.subscribe(reportTopic, (error) => {
            if (generation !== current) return;
            if (error) { fail('Printer subscription was rejected. Check its LAN access code and Developer Mode setting.', current); return; }
            emit({ ...snapshot, connection: 'connected', error: undefined });
            const callback = (error?: Error) => { if (error) fail(CONNECTION_HELP, current); };
            transport?.publish(requestTopic, JSON.stringify({ pushing: { sequence_id: '1', command: 'pushall' } }), callback);
            if (generation === current) transport?.publish(requestTopic, JSON.stringify({ info: { sequence_id: '2', command: 'get_version' } }), callback);
          });
        },
        message(topic, payload) {
          if (generation !== current || topic !== reportTopic) return;
          const status = normalizeReport(snapshot.status, payload, dependencies.now?.() ?? Date.now());
          if (!status) return;
          cancelTimer();
          retries = 0;
          emit({ ...snapshot, status });
        },
        closed() { fail(CONNECTION_HELP, current); },
        error(error) {
          // Inspect only a known code. Never copy native messages that may contain credentials.
          const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
          fail(code === 4 || code === 5 ? 'Printer rejected authentication. Check the LAN access code and Developer Mode setting.' : CONNECTION_HELP, current);
        },
      });
    } catch { fail(CONNECTION_HELP, current); }
  };
  return {
    start(nextProfile, nextCode) {
      dispose();
      profile = undefined;
      accessCode = '';
      const errors = validateProfile(nextProfile, nextCode);
      if (Object.keys(errors).length) { emit({ connection: 'failed', status: {}, error: Object.values(errors)[0] }); return; }
      profile = { ...nextProfile, host: nextProfile.host.trim(), serial: nextProfile.serial.trim() };
      accessCode = nextCode;
      retries = 0;
      emit({ connection: 'connecting', status: {} });
      connect();
    },
    stop() { dispose(); profile = undefined; accessCode = ''; emit({ connection: 'disconnected', status: {} }); },
    subscribe(listener) { listeners.add(listener); listener(snapshot); return () => { listeners.delete(listener); }; },
  };
}

import { normalizeReport } from './normalize';
import { validateProfile } from './validation';
import { connectionError } from './connection-error';
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
  createTransport(
    profile: PrinterProfile,
    accessCode: string,
    events: TransportEvents,
  ): SessionTransport;
  now?: () => number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 15000];

/** Foreground owner must call stop() when hidden/backgrounded; all work is cancellable. */
export function createSessionCore(dependencies: SessionDependencies): PrinterSession {
  const setTimer = dependencies.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
  const clearTimer =
    dependencies.clearTimer ?? ((timer) => clearTimeout(timer as ReturnType<typeof setTimeout>));
  const listeners = new Set<(snapshot: SessionSnapshot) => void>();
  let snapshot: SessionSnapshot = { connection: 'disconnected', status: {} };
  let generation = 0;
  let transport: SessionTransport | undefined;
  let timer: unknown;
  let profile: PrinterProfile | undefined;
  let accessCode = '';
  let retries = 0;
  const emit = (next: SessionSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener(snapshot);
  };
  const cancelTimer = () => {
    if (timer !== undefined) clearTimer(timer);
    timer = undefined;
  };
  const dispose = () => {
    generation++;
    cancelTimer();
    const old = transport;
    transport = undefined;
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
    timer = setTimer(() => {
      timer = undefined;
      if (generation === retryGeneration) connect();
    }, delay);
  };
  const connect = () => {
    if (!profile) return;
    const current = ++generation;
    const reportTopic = `device/${profile.serial.trim()}/report`;
    const requestTopic = `device/${profile.serial.trim()}/request`;
    let phase: 'connect' | 'subscribe' | 'status' = 'connect';
    timer = setTimer(
      () =>
        fail(
          phase === 'status'
            ? 'Connected, but no printer status arrived. Check the serial number and the printer’s Developer Mode setting.'
            : phase === 'subscribe'
              ? 'MQTT connected, but the printer did not acknowledge its status subscription.'
              : 'Timed out connecting to the printer on port 8883.',
          current,
        ),
      15000,
    );
    try {
      transport = dependencies.createTransport(profile, accessCode, {
        connected() {
          if (generation !== current) return;
          phase = 'subscribe';
          transport?.subscribe(reportTopic, (error) => {
            if (generation !== current) return;
            if (error) {
              fail(
                'Printer rejected the status subscription. Check its serial number and Developer Mode setting.',
                current,
              );
              return;
            }
            phase = 'status';
            emit({ ...snapshot, connection: 'connected', error: undefined });
            const callback = (error?: Error) => {
              if (error) fail(connectionError(error).message, current);
            };
            transport?.publish(
              requestTopic,
              JSON.stringify({ pushing: { sequence_id: '1', command: 'pushall' } }),
              callback,
            );
            if (generation === current)
              transport?.publish(
                requestTopic,
                JSON.stringify({ info: { sequence_id: '2', command: 'get_version' } }),
                callback,
              );
          });
        },
        message(topic, payload) {
          if (generation !== current || topic !== reportTopic) return;
          const status = normalizeReport(
            snapshot.status,
            payload,
            dependencies.now?.() ?? Date.now(),
          );
          if (!status) return;
          cancelTimer();
          retries = 0;
          emit({ ...snapshot, status });
        },
        closed() {
          fail('MQTT connection closed. Reconnect to resume monitoring.', current);
        },
        error(error) {
          fail(connectionError(error).message, current);
        },
      });
    } catch (error) {
      fail(connectionError(error, 'startup').message, current);
    }
  };
  return {
    start(nextProfile, nextCode) {
      dispose();
      profile = undefined;
      accessCode = '';
      const errors = validateProfile(nextProfile, nextCode);
      if (Object.keys(errors).length) {
        emit({ connection: 'failed', status: {}, error: Object.values(errors)[0] });
        return;
      }
      profile = {
        ...nextProfile,
        host: nextProfile.host.trim(),
        serial: nextProfile.serial.trim(),
      };
      accessCode = nextCode;
      retries = 0;
      emit({ connection: 'connecting', status: {} });
      connect();
    },
    stop() {
      dispose();
      profile = undefined;
      accessCode = '';
      emit({ connection: 'disconnected', status: {} });
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

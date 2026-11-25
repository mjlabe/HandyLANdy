import type { PrinterSession, SessionSnapshot } from './types';

export function createPrinterSession(): PrinterSession {
  const listeners = new Set<(snapshot: SessionSnapshot) => void>();
  let snapshot: SessionSnapshot = { connection: 'disconnected', status: {} };
  const emit = (next: SessionSnapshot) => { snapshot = next; listeners.forEach((listener) => listener(snapshot)); };
  return {
    start() { emit({ connection: 'failed', status: {}, error: 'Direct LAN printer connections require an iOS or Android development build. Web browsers cannot open the printer TLS socket.' }); },
    stop() { emit({ connection: 'disconnected', status: {} }); },
    subscribe(listener) { listeners.add(listener); listener(snapshot); return () => { listeners.delete(listener); }; },
  };
}

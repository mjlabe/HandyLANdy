import type { PrinterProfile } from './types';

export interface TlsSocket {
  on(event: 'secureConnect' | 'close' | 'end' | 'timeout', listener: () => void): unknown;
  on(event: 'data', listener: (data: Uint8Array | string) => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  removeAllListeners(): unknown;
  write(data: Uint8Array, encoding?: 'utf8', callback?: (error?: Error) => void): boolean;
  setTimeout(ms: number): unknown;
  destroy(): unknown;
  pause(): unknown;
  resume(): unknown;
}
export type TlsSocketFactory = (profile: PrinterProfile, port: number) => TlsSocket;

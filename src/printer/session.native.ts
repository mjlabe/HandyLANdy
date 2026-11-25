import { createMqttTransport } from './mqtt-transport';
import { createSessionCore } from './session-core';
import { createNativeTlsSocket } from './tls-socket.native';
import type { PrinterSession } from './types';

export function createPrinterSession(): PrinterSession {
  return createSessionCore({ createTransport: (profile, accessCode, events) => createMqttTransport(profile, accessCode, events, createNativeTlsSocket) });
}

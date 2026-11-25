import ClientImplementation from 'mqtt/lib/client';
import type { MqttClient as ClientConstructor } from 'mqtt';
import { Buffer } from 'buffer';
import { createTlsDuplex } from './tls-duplex';
import type { SessionTransport, TransportEvents } from './session-core';
import type { TlsSocket, TlsSocketFactory } from './tls-types';
import type { PrinterProfile } from './types';
import { ensureMqttRuntime } from './runtime';
import { connectionError } from './connection-error';

export function createMqttTransport(
  profile: PrinterProfile,
  accessCode: string,
  events: TransportEvents,
  createSocket: TlsSocketFactory,
): SessionTransport {
  let disposed = false;
  let socket: TlsSocket | undefined;
  let acquiredStream: ReturnType<typeof createTlsDuplex> | undefined;
  let acquiredClient: InstanceType<typeof ClientConstructor> | undefined;
  function release() {
    if (disposed) return;
    disposed = true;
    // Startup may stop between resource acquisitions. A teardown failure must
    // not prevent the remaining resources from being released.
    const attempt = (cleanup: () => void) => {
      try {
        cleanup();
      } catch {}
    };
    attempt(() => {
      acquiredClient?.end(true);
    });
    attempt(() => {
      acquiredStream?.destroy();
    });
    attempt(() => {
      socket?.setTimeout(0);
    });
    attempt(() => {
      socket?.removeAllListeners();
    });
    attempt(() => {
      socket?.on('error', () => {});
    });
    attempt(() => {
      socket?.destroy();
    });
  }
  try {
    ensureMqttRuntime();
    socket = createSocket(profile, 8883);
    const stream = createTlsDuplex(socket);
    acquiredStream = stream;
    // Use the injectable client directly: the bundled RN entry owns a private
    // Buffer constructor and rejects credential buffers from our socket stack.
    // MQTT's broad typesVersions mapping mis-types this subpath as the root API.
    const MqttClient = ClientImplementation as unknown as typeof ClientConstructor;
    const client = new MqttClient(() => stream, {
      // Binary password also avoids mqtt-packet's optional writeString diagnostics.
      username: 'bblp',
      password: Buffer.from(accessCode, 'ascii'),
      protocolVersion: 4,
      clean: true,
      clientId: `handylandy_${Math.random().toString(16).slice(2, 14)}`,
      keepalive: 20,
      connectTimeout: 15000,
      reconnectPeriod: 0,
      resubscribe: false,
      queueQoSZero: false,
      manualConnect: true,
      timerVariant: 'native',
      // MQTT.js otherwise logs the full CONNECT packet under DEBUG=mqttjs:*.
      log: () => {},
    });
    acquiredClient = client;
    client.on('connect', () => {
      if (!disposed) events.connected();
    });
    client.on('message', (topic, payload) => {
      if (!disposed && payload.length <= 1024 * 1024)
        events.message(topic, payload.toString('utf8'));
    });
    client.on('error', (error) => {
      if (!disposed) events.error(error);
    });
    client.on('close', () => {
      if (!disposed) events.closed();
    });
    client.connect();
    return {
      subscribe(topic, callback) {
        client.subscribe(topic, { qos: 0 }, (error, granted) => {
          if (disposed) return;
          callback(
            error ??
              (granted?.length && granted.every((item) => item.qos !== 128)
                ? undefined
                : new Error('Printer subscription rejected.')),
          );
        });
      },
      publish(topic, payload, callback) {
        if (!disposed) client.publish(topic, payload, { qos: 0, retain: false }, callback);
      },
      close: release,
    };
  } catch (error) {
    release();
    throw connectionError(error, 'startup');
  }
}

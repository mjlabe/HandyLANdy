import { Buffer } from 'buffer';
import { Duplex } from 'readable-stream';
import type { TlsSocket } from './tls-types';
import { MqttPacketGate } from './mqtt-framing';
import { connectionError } from './connection-error';

/** MQTT.js expects a Node-style Duplex; the native socket is an event emitter. */
export function createTlsDuplex(socket: TlsSocket): Duplex {
  let secure = false;
  let pending: (() => void) | undefined;
  function write(chunk: Uint8Array, callback: (error?: Error | null) => void) {
    const flush = () => {
      if (stream.destroyed) {
        callback(new Error('Connection closed.'));
        return;
      }
      try {
        socket.write(chunk, undefined, callback);
      } catch (error) {
        callback(connectionError(error));
      }
    };
    if (secure) flush();
    else pending = flush;
  }
  const stream = new Duplex({
    read() {
      socket.resume();
    },
    write(chunk: Uint8Array, _encoding, callback) {
      write(chunk, callback);
    },
    writev(chunks, callback) {
      // MQTT.js corks each packet. Keep it together across the native bridge.
      write(Buffer.concat(Array.from(chunks, ({ chunk }) => Buffer.from(chunk))), callback);
    },
    destroy(error, callback) {
      const queuedWrite = pending;
      pending = undefined;
      queuedWrite?.();
      gate.reset();
      socket.setTimeout(0);
      socket.removeAllListeners();
      socket.on('error', () => {});
      socket.destroy();
      callback(error);
    },
  });
  const gate = new MqttPacketGate((chunk) => {
    if (!stream.push(Buffer.from(chunk))) socket.pause();
  });
  socket.on('secureConnect', () => {
    if (stream.destroyed) return;
    secure = true;
    const write = pending;
    pending = undefined;
    write?.();
  });
  socket.on('data', (data) => {
    if (stream.destroyed) return;
    if (typeof data === 'string') {
      stream.destroy(new Error('Invalid binary printer stream.'));
      return;
    }
    try {
      gate.push(data);
    } catch {
      stream.destroy(new Error('Invalid or oversized printer MQTT packet size or length.'));
    }
  });
  socket.on('end', () => {
    if (!stream.destroyed) stream.push(null);
  });
  socket.on('close', () => stream.destroy());
  socket.on('error', (error) => stream.destroy(connectionError(error)));
  socket.on('timeout', () => stream.destroy(connectionError({ code: 'ETIMEDOUT' })));
  return stream;
}

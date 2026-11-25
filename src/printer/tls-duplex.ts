import { Buffer } from 'buffer';
import { Duplex } from 'readable-stream';
import type { TlsSocket } from './tls-types';
import { MqttPacketGate } from './mqtt-framing';

/** MQTT.js expects a Node-style Duplex; the native socket is an event emitter. */
export function createTlsDuplex(socket: TlsSocket): Duplex {
  let secure = false;
  let pending: (() => void) | undefined;
  const stream = new Duplex({
    read() { socket.resume(); },
    write(chunk: Uint8Array, _encoding, callback) {
      const write = () => {
        if (stream.destroyed) { callback(new Error('Connection closed.')); return; }
        try { socket.write(chunk, undefined, callback); } catch { callback(new Error('Printer connection write failed.')); }
      };
      if (secure) write(); else pending = write;
    },
    destroy(error, callback) {
      const queuedWrite = pending; pending = undefined;
      queuedWrite?.();
      gate.reset();
      socket.setTimeout(0);
      socket.removeAllListeners();
      socket.on('error', () => {});
      socket.destroy();
      callback(error);
    },
  });
  const gate = new MqttPacketGate(chunk => {
    if (!stream.push(Buffer.from(chunk))) socket.pause();
  });
  socket.on('secureConnect', () => {
    if (stream.destroyed) return;
    secure = true;
    const write = pending; pending = undefined; write?.();
  });
  socket.on('data', (data) => {
    if (stream.destroyed) return;
    if (typeof data === 'string') { stream.destroy(new Error('Invalid binary printer stream.')); return; }
    try { gate.push(data); }
    catch { stream.destroy(new Error('Invalid or oversized printer MQTT packet size or length.')); }
  });
  socket.on('end', () => { if (!stream.destroyed) stream.push(null); });
  socket.on('close', () => stream.destroy());
  socket.on('error', () => stream.destroy(new Error('Printer TLS connection failed.')));
  socket.on('timeout', () => stream.destroy(new Error('Printer connection timed out.')));
  return stream;
}

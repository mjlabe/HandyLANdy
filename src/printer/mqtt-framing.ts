/** Bound complete MQTT packets before MQTT.js can accumulate their bodies. */
export const MAX_MQTT_PACKET_BYTES = 1024 * 1024;

/** Retains only the at-most-five-byte fixed header. Valid bodies stream through. */
export class MqttPacketGate {
  private readonly header = new Uint8Array(5);
  private headerSize = 0;
  private remainingLength = 0;
  private bodyRemaining = 0;
  private failed = false;

  constructor(private readonly onChunk: (chunk: Uint8Array) => void) {}
  get bufferedBytes() { return this.headerSize; }

  reset() {
    this.headerSize = 0;
    this.remainingLength = 0;
    this.bodyRemaining = 0;
    this.failed = false;
  }

  push(chunk: Uint8Array): void {
    if (this.failed) return;
    try {
      let offset = 0;
      while (offset < chunk.length) {
        if (this.bodyRemaining > 0) {
          const count = Math.min(this.bodyRemaining, chunk.length - offset);
          this.bodyRemaining -= count;
          this.onChunk(chunk.subarray(offset, offset + count));
          offset += count;
          continue;
        }
        const byte = chunk[offset++];
        this.header[this.headerSize++] = byte;
        if (this.headerSize === 1) continue;
        this.remainingLength += (byte & 0x7f) * 128 ** (this.headerSize - 2);
        if (byte & 0x80) {
          if (this.headerSize === 5) throw new Error('Invalid MQTT remaining length.');
          continue;
        }
        if (this.headerSize > 2 && byte === 0) throw new Error('Invalid MQTT remaining length encoding.');
        if (this.headerSize + this.remainingLength > MAX_MQTT_PACKET_BYTES) throw new Error('Printer MQTT packet size exceeds the supported limit.');
        const checkedHeader = this.header.slice(0, this.headerSize);
        this.bodyRemaining = this.remainingLength;
        this.headerSize = 0;
        this.remainingLength = 0;
        this.onChunk(checkedHeader);
      }
    } catch (error) {
      this.reset();
      this.failed = true;
      throw error;
    }
  }
}

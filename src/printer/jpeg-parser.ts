import { Buffer } from 'buffer';

export const MAX_FRAME_BYTES = 10 * 1024 * 1024;

/** Fixed camera authentication packet; never include its contents in diagnostics. */
export function createCameraAuth(accessCode: string): Uint8Array {
  if (!/^[\x21-\x7e]{1,32}$/.test(accessCode)) throw new Error('Invalid LAN access code.');
  const packet = Buffer.alloc(80);
  packet[0] = 0x40;
  packet[5] = 0x30;
  packet.write('bblp', 16, 'ascii');
  packet.write(accessCode, 48, 'ascii');
  return packet;
}

/** Incremental parser holds at most one checked frame and its 16-byte header. */
export class JpegFrameParser {
  private header = new Uint8Array(16);
  private headerSize = 0;
  private body: Uint8Array | undefined;
  private bodySize = 0;
  private failed = false;

  constructor(private readonly onFrame: (jpeg: Uint8Array) => void) {}
  get bufferedBytes() { return this.headerSize + this.bodySize; }
  reset() { this.headerSize = 0; this.body = undefined; this.bodySize = 0; this.failed = false; }

  push(chunk: Uint8Array) {
    if (this.failed) return;
    try {
      let offset = 0;
      while (offset < chunk.length) {
        if (!this.body) {
          const count = Math.min(16 - this.headerSize, chunk.length - offset);
          this.header.set(chunk.subarray(offset, offset + count), this.headerSize);
          this.headerSize += count;
          offset += count;
          if (this.headerSize < 16) continue;
          const length = new DataView(this.header.buffer).getUint32(0, true);
          if (length < 4 || length > MAX_FRAME_BYTES) throw new Error('Invalid camera frame length.');
          this.body = new Uint8Array(length);
          this.headerSize = 0;
        }
        const count = Math.min(this.body.length - this.bodySize, chunk.length - offset);
        this.body.set(chunk.subarray(offset, offset + count), this.bodySize);
        this.bodySize += count;
        offset += count;
        if (this.bodySize === this.body.length) {
          const jpeg = this.body;
          this.body = undefined;
          this.bodySize = 0;
          if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8 || jpeg[jpeg.length - 2] !== 0xff || jpeg[jpeg.length - 1] !== 0xd9) throw new Error('Invalid JPEG camera frame.');
          this.onFrame(jpeg);
        }
      }
    } catch (error) { this.reset(); this.failed = true; throw error; }
  }
}

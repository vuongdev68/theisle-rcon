import { PacketTerminator } from "./RconTypes.js";
import { RconPacket, type DecodedPacket } from "./RconPacket.js";

/**
 * TCP stream parser for Evrima RCON.
 *
 * TCP is a byte stream: one socket "data" event is not one packet.
 * Frames are typically NUL-terminated. Incomplete data stays buffered.
 * Multiple complete frames in one chunk are all extracted.
 */
export class RconParser {
  private buffer = Buffer.alloc(0);

  feed(chunk: Buffer): DecodedPacket[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    return this.parsePackets();
  }

  parsePackets(): DecodedPacket[] {
    const packets: DecodedPacket[] = [];

    while (this.buffer.length > 0) {
      const nulIndex = this.buffer.indexOf(PacketTerminator);
      if (nulIndex === -1) {
        break;
      }

      const frame = this.buffer.subarray(0, nulIndex + 1);
      this.buffer = this.buffer.subarray(nulIndex + 1);

      if (frame.length === 1) {
        continue;
      }

      packets.push(RconPacket.decodePacket(frame));
    }

    return packets;
  }

  remaining(): Buffer {
    return Buffer.from(this.buffer);
  }

  hasRemaining(): boolean {
    return this.buffer.length > 0;
  }

  flushRemaining(): DecodedPacket | undefined {
    if (this.buffer.length === 0) {
      return undefined;
    }
    const leftover = this.buffer;
    this.buffer = Buffer.alloc(0);
    return RconPacket.decodePacket(leftover);
  }

  reset(): void {
    this.buffer = Buffer.alloc(0);
  }
}

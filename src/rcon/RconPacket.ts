import { PacketTerminator, PacketType, type PacketTypeValue } from "./RconTypes.js";
import { RconProtocolError } from "./RconErrors.js";

export interface EncodedPacket {
  type: PacketTypeValue;
  opcode?: number;
  body: string;
  raw: Buffer;
}

export interface DecodedPacket {
  type: number;
  opcode?: number;
  body: string;
  raw: Buffer;
}

/**
 * Encode / decode Evrima RCON frames.
 *
 * Auth:      [0x01] [password...] [0x00]
 * Command:   [0x02] [opcode] [comma-separated args...] [0x00]
 * Response:  optional [0x03] [body...] [optional 0x00]
 *
 * There is no length prefix and no request ID on the wire.
 */
export class RconPacket {
  static encodeAuth(password: string): Buffer {
    return Buffer.concat([
      Buffer.from([PacketType.Auth]),
      Buffer.from(password, "utf8"),
      Buffer.from([PacketTerminator]),
    ]);
  }

  static encodeCommand(opcode: number, args = ""): Buffer {
    if (!Number.isInteger(opcode) || opcode < 0 || opcode > 255) {
      throw new RconProtocolError("Command opcode must be an unsigned byte", {
        reason: "invalid_opcode",
      });
    }
    return Buffer.concat([
      Buffer.from([PacketType.ExecCommand, opcode]),
      Buffer.from(args, "utf8"),
      Buffer.from([PacketTerminator]),
    ]);
  }

  static encodePacket(input: { type: number; opcode?: number; body?: string }): Buffer {
    if (input.type === PacketType.Auth) {
      return RconPacket.encodeAuth(input.body ?? "");
    }
    if (input.type === PacketType.ExecCommand) {
      if (input.opcode === undefined) {
        throw new RconProtocolError("ExecCommand packet requires opcode");
      }
      return RconPacket.encodeCommand(input.opcode, input.body ?? "");
    }
    const body = Buffer.from(input.body ?? "", "utf8");
    return Buffer.concat([Buffer.from([input.type]), body, Buffer.from([PacketTerminator])]);
  }

  static decodePacket(buffer: Buffer): DecodedPacket {
    if (buffer.length === 0) {
      throw new RconProtocolError("Cannot decode empty packet");
    }

    const stripped = stripTrailingNuls(buffer);
    if (stripped.length === 0) {
      return { type: PacketType.ResponseValue, body: "", raw: Buffer.from(buffer) };
    }

    const first = stripped[0];
    if (first === undefined) {
      throw new RconProtocolError("Cannot decode empty packet");
    }

    if (first === PacketType.Auth) {
      return {
        type: PacketType.Auth,
        body: stripped.subarray(1).toString("utf8"),
        raw: Buffer.from(buffer),
      };
    }

    if (first === PacketType.ExecCommand) {
      if (stripped.length < 2) {
        throw new RconProtocolError("ExecCommand packet is truncated");
      }
      const opcode = stripped[1];
      if (opcode === undefined) {
        throw new RconProtocolError("ExecCommand packet is truncated");
      }
      return {
        type: PacketType.ExecCommand,
        opcode,
        body: stripped.subarray(2).toString("utf8"),
        raw: Buffer.from(buffer),
      };
    }

    if (first === PacketType.ResponseValue) {
      return {
        type: PacketType.ResponseValue,
        body: stripped.subarray(1).toString("utf8"),
        raw: Buffer.from(buffer),
      };
    }

    return {
      type: PacketType.ResponseValue,
      body: stripped.toString("utf8"),
      raw: Buffer.from(buffer),
    };
  }

  static validatePacket(buffer: Buffer): boolean {
    try {
      const decoded = RconPacket.decodePacket(buffer);
      if (decoded.type === PacketType.ExecCommand && decoded.opcode === undefined) {
        return false;
      }
      return decoded.type === PacketType.Auth
        || decoded.type === PacketType.ExecCommand
        || decoded.type === PacketType.ResponseValue;
    } catch {
      return false;
    }
  }
}

export function stripTrailingNuls(buffer: Buffer): Buffer {
  let end = buffer.length;
  while (end > 0 && buffer[end - 1] === PacketTerminator) {
    end -= 1;
  }
  return buffer.subarray(0, end);
}

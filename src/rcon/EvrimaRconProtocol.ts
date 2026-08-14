import { AuthResponse, PacketType } from "./RconTypes.js";
import { RconPacket, type DecodedPacket } from "./RconPacket.js";
import { RconParser } from "./RconParser.js";

export interface ProtocolCommand {
  opcode: number;
  args?: string;
}

/**
 * Evrima RCON protocol helpers.
 *
 * Verified against:
 * - Theislemanager/evrima-rcon (PHP, cites developer Game.ini / opcode docs)
 * - menix1337/isle-evrima-rcon (TypeScript, maintained 2026)
 * - Butt4cak3/theislercon (Go reverse-engineering)
 * - aerond7/TheIsleEvrimaRconClient (C#)
 * - Game Host Bros current command list
 */
export class EvrimaRconProtocol {
  static readonly AUTH_SUCCESS = AuthResponse.Accepted;
  static readonly AUTH_FAILURE = AuthResponse.Incorrect;

  encodeAuth(password: string): Buffer {
    return RconPacket.encodeAuth(password);
  }

  encodeCommand(opcode: number, args = ""): Buffer {
    return RconPacket.encodeCommand(opcode, args);
  }

  encodePacket(input: { type: number; opcode?: number; body?: string }): Buffer {
    return RconPacket.encodePacket(input);
  }

  decodePacket(buffer: Buffer): DecodedPacket {
    return RconPacket.decodePacket(buffer);
  }

  parsePackets(parser: RconParser, chunk: Buffer): DecodedPacket[] {
    return parser.feed(chunk);
  }

  validatePacket(buffer: Buffer): boolean {
    return RconPacket.validatePacket(buffer);
  }

  isAuthSuccess(body: string): boolean {
    return body.includes(AuthResponse.Accepted);
  }

  isAuthFailure(body: string): boolean {
    return body.includes(AuthResponse.Incorrect);
  }

  joinArguments(values: Array<string | number | undefined | null>): string {
    return values
      .filter((value): value is string | number => value !== undefined && value !== null && value !== "")
      .map((value) => String(value))
      .join(",");
  }

  static isResponseType(type: number): boolean {
    return type === PacketType.ResponseValue || type > PacketType.ExecCommand;
  }
}

export const evrimaProtocol = new EvrimaRconProtocol();

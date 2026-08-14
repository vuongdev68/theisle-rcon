import { describe, expect, it } from "vitest";
import { RconPacket } from "../../src/rcon/RconPacket.js";
import { PacketType } from "../../src/rcon/RconTypes.js";
import { evrimaProtocol } from "../../src/rcon/EvrimaRconProtocol.js";

describe("RconPacket encoding", () => {
  it("encodes auth as 0x01 + password + NUL", () => {
    const packet = RconPacket.encodeAuth("hunter2");
    expect(packet[0]).toBe(PacketType.Auth);
    expect(packet[packet.length - 1]).toBe(0x00);
    expect(packet.subarray(1, -1).toString("utf8")).toBe("hunter2");
  });

  it("encodes command as 0x02 + opcode + args + NUL", () => {
    const packet = RconPacket.encodeCommand(0x40, "");
    expect([...packet]).toEqual([0x02, 0x40, 0x00]);
  });

  it("encodes announce with message body", () => {
    const packet = RconPacket.encodeCommand(0x10, "Hello");
    expect(packet[0]).toBe(0x02);
    expect(packet[1]).toBe(0x10);
    expect(packet.subarray(2, -1).toString("utf8")).toBe("Hello");
  });

  it("encodes comma-separated arguments", () => {
    const args = evrimaProtocol.joinArguments(["76561198000000000", "hello world"]);
    const packet = RconPacket.encodeCommand(0x11, args);
    expect(packet.subarray(2, -1).toString("utf8")).toBe("76561198000000000,hello world");
  });
});

describe("RconPacket decoding", () => {
  it("decodes a typed response starting with 0x03", () => {
    const decoded = RconPacket.decodePacket(Buffer.from([0x03, 0x50, 0x61, 0x73, 0x73, 0x00]));
    expect(decoded.type).toBe(PacketType.ResponseValue);
    expect(decoded.body).toBe("Pass");
  });

  it("decodes a raw text response without type byte", () => {
    const decoded = RconPacket.decodePacket(Buffer.from("Password Accepted\0"));
    expect(decoded.body).toBe("Password Accepted");
  });

  it("decodes an exec command packet", () => {
    const encoded = RconPacket.encodeCommand(0x40, "unused");
    const decoded = RconPacket.decodePacket(encoded);
    expect(decoded.type).toBe(PacketType.ExecCommand);
    expect(decoded.opcode).toBe(0x40);
    expect(decoded.body).toBe("unused");
  });

  it("validates known packets", () => {
    expect(RconPacket.validatePacket(RconPacket.encodeAuth("x"))).toBe(true);
    expect(RconPacket.validatePacket(RconPacket.encodeCommand(0x50))).toBe(true);
  });
});

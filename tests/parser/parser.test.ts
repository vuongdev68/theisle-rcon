import { describe, expect, it } from "vitest";
import { RconParser } from "../../src/rcon/RconParser.js";
import { RconPacket } from "../../src/rcon/RconPacket.js";

describe("RconParser TCP stream", () => {
  it("holds a partial packet until NUL arrives", () => {
    const parser = new RconParser();
    expect(parser.feed(Buffer.from("Pass")).length).toBe(0);
    expect(parser.hasRemaining()).toBe(true);
    const packets = parser.feed(Buffer.from("word Accepted\0"));
    expect(packets).toHaveLength(1);
    expect(packets[0]?.body).toBe("Password Accepted");
    expect(parser.hasRemaining()).toBe(false);
  });

  it("extracts multiple packets from one TCP chunk", () => {
    const parser = new RconParser();
    const first = Buffer.from("Alpha\0");
    const second = Buffer.from("Beta\0");
    const packets = parser.feed(Buffer.concat([first, second]));
    expect(packets.map((packet) => packet.body)).toEqual(["Alpha", "Beta"]);
  });

  it("keeps leftover bytes after a complete packet", () => {
    const parser = new RconParser();
    const packets = parser.feed(Buffer.from("One\0Two"));
    expect(packets).toHaveLength(1);
    expect(packets[0]?.body).toBe("One");
    expect(parser.remaining().toString("utf8")).toBe("Two");
    const flushed = parser.flushRemaining();
    expect(flushed?.body).toBe("Two");
  });

  it("round-trips a command packet through the stream parser", () => {
    const parser = new RconParser();
    const encoded = RconPacket.encodeCommand(0x12, "");
    const firstHalf = encoded.subarray(0, 1);
    const secondHalf = encoded.subarray(1);
    expect(parser.feed(firstHalf)).toHaveLength(0);
    const packets = parser.feed(secondHalf);
    expect(packets[0]?.opcode ?? packets[0]?.type).toBeDefined();
    expect(packets[0]?.type).toBe(0x02);
    expect(packets[0]?.opcode).toBe(0x12);
  });
});

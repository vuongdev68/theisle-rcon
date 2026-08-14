import { describe, expect, it } from "vitest";
import { EvrimaRconClient } from "../../src/rcon/EvrimaRconClient.js";
import { createLogger } from "../../src/utils/logger.js";

const run = process.env.RUN_RCON_INTEGRATION_TESTS === "true";

describe.skipIf(!run)("live RCON integration", () => {
  it("connects to 127.0.0.1:8888 and runs playerlist", async () => {
    const password = process.env.RCON_PASSWORD;
    if (!password) {
      throw new Error("RCON_PASSWORD is required for integration tests");
    }
    const client = new EvrimaRconClient(
      {
        host: process.env.RCON_HOST ?? "127.0.0.1",
        port: Number(process.env.RCON_PORT ?? 8888),
        password,
        reconnect: false,
        timeoutMs: 5000,
      },
      createLogger({ level: "silent", pretty: false }),
    );
    await client.connect();
    const players = await client.playerList();
    expect(Array.isArray(players)).toBe(true);
    const health = await client.healthCheck();
    expect(health.connected).toBe(true);
    expect(health.authenticated).toBe(true);
    await client.disconnect();
  });
});

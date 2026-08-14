import { afterEach, describe, expect, it } from "vitest";
import { EvrimaRconClient } from "../../src/rcon/EvrimaRconClient.js";
import { RconAuthenticationError, RconTimeoutError } from "../../src/rcon/RconErrors.js";
import { createLogger } from "../../src/utils/logger.js";
import { MockEvrimaRconServer } from "../helpers/mockRconServer.js";

const logger = createLogger({ level: "silent", pretty: false });

describe("authentication", () => {
  let server: MockEvrimaRconServer | undefined;
  let client: EvrimaRconClient | undefined;

  afterEach(async () => {
    await client?.disconnect().catch(() => undefined);
    await server?.close().catch(() => undefined);
  });

  it("authenticates with Password Accepted", async () => {
    server = new MockEvrimaRconServer({ password: "correct" });
    const address = await server.listen();
    client = new EvrimaRconClient({ ...address, password: "correct", reconnect: false }, logger);
    await client.connect();
    expect(client.isAuthenticated()).toBe(true);
  });

  it("throws RconAuthenticationError on incorrect password", async () => {
    server = new MockEvrimaRconServer({ password: "correct" });
    const address = await server.listen();
    client = new EvrimaRconClient({ ...address, password: "wrong", reconnect: false }, logger);
    await expect(client.connect()).rejects.toBeInstanceOf(RconAuthenticationError);
    expect(client.isAuthenticated()).toBe(false);
  });
});

describe("request IDs and concurrency", () => {
  let server: MockEvrimaRconServer | undefined;
  let client: EvrimaRconClient | undefined;

  afterEach(async () => {
    await client?.disconnect().catch(() => undefined);
    await server?.close().catch(() => undefined);
  });

  it("assigns unique request IDs and does not mix responses", async () => {
    server = new MockEvrimaRconServer({
      password: "pw",
      onCommand: (opcode) => {
        if (opcode === 0x40) {
          return "PlayerList\n1,Alice,eos1,";
        }
        if (opcode === 0x12) {
          return "ServerDetails ServerName: TestWorld, ServerMap: Gateway, ServerMaxPlayers: 50, ServerCurrentPlayers: 1";
        }
        return `ok-${opcode}`;
      },
    });
    const address = await server.listen();
    client = new EvrimaRconClient(
      { ...address, password: "pw", reconnect: false, initialRequestId: 1001 },
      logger,
    );
    await client.connect();

    const requestIds: number[] = [];
    client.on("commandSent", ({ requestId }) => {
      requestIds.push(requestId);
    });

    const [players, details] = await Promise.all([client.playerList(), client.getServerDetails()]);
    expect(players[0]?.name).toBe("Alice");
    expect(details.name).toBe("TestWorld");
    expect(new Set(requestIds).size).toBe(requestIds.length);
    expect(requestIds[0]).toBeGreaterThanOrEqual(1001);
  });
});

describe("timeout", () => {
  let server: MockEvrimaRconServer | undefined;
  let client: EvrimaRconClient | undefined;

  afterEach(async () => {
    await client?.disconnect().catch(() => undefined);
    await server?.close().catch(() => undefined);
  });

  it("throws RconTimeoutError when a response is expected and none arrives", async () => {
    server = new MockEvrimaRconServer({ password: "pw", silentCommands: true });
    const address = await server.listen();
    client = new EvrimaRconClient({ ...address, password: "pw", reconnect: false, timeoutMs: 200 }, logger);
    await client.connect();
    await expect(client.playerList({ timeout: 150, allowEmptyResponse: false })).rejects.toBeInstanceOf(
      RconTimeoutError,
    );
  });
});

describe("reconnect", () => {
  let server: MockEvrimaRconServer | undefined;
  let client: EvrimaRconClient | undefined;

  afterEach(async () => {
    await client?.disconnect().catch(() => undefined);
    await server?.close().catch(() => undefined);
  });

  it("reconnects after the remote socket closes", async () => {
    server = new MockEvrimaRconServer({ password: "pw" });
    const address = await server.listen();
    client = new EvrimaRconClient(
      {
        ...address,
        password: "pw",
        reconnect: true,
        reconnectDelayMs: 50,
        reconnectMaxDelayMs: 200,
        timeoutMs: 1000,
      },
      logger,
    );
    await client.connect();
    expect(client.isAuthenticated()).toBe(true);

    const reconnected = new Promise<void>((resolve) => {
      client?.once("authenticated", () => resolve());
    });

    server.dropConnections();
    await reconnected;
    expect(client.isAuthenticated()).toBe(true);
  }, 10_000);
});

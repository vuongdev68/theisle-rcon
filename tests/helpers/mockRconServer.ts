import { createServer, type AddressInfo, type Server, type Socket } from "node:net";
import { PacketTerminator, PacketType } from "../../src/rcon/RconTypes.js";

export interface MockRconServerOptions {
  password?: string;
  silentCommands?: boolean;
  onCommand?: (opcode: number, args: string) => string | undefined;
}

export class MockEvrimaRconServer {
  private server: Server | undefined;
  private sockets: Socket[] = [];
  password: string;
  silentCommands: boolean;
  onCommand?: (opcode: number, args: string) => string | undefined;
  received: Buffer[] = [];

  constructor(options: MockRconServerOptions = {}) {
    this.password = options.password ?? "secret";
    this.silentCommands = options.silentCommands ?? false;
    this.onCommand = options.onCommand;
  }

  async listen(): Promise<{ host: string; port: number }> {
    this.server = createServer((socket) => this.handleSocket(socket));
    await new Promise<void>((resolve) => {
      this.server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = this.server.address() as AddressInfo;
    return { host: address.address, port: address.port };
  }

  dropConnections(): void {
    for (const socket of this.sockets) {
      socket.destroy();
    }
    this.sockets = [];
  }

  async close(): Promise<void> {
    for (const socket of this.sockets) {
      socket.destroy();
    }
    this.sockets = [];
    await new Promise<void>((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private handleSocket(socket: Socket): void {
    this.sockets.push(socket);
    let buffer = Buffer.alloc(0);
    let authenticated = false;

    socket.on("data", (chunk) => {
      this.received.push(Buffer.from(chunk));
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length > 0) {
        const nul = buffer.indexOf(PacketTerminator);
        const frame = nul === -1 ? buffer : buffer.subarray(0, nul + 1);
        if (nul === -1 && buffer.length < 2) {
          break;
        }
        buffer = nul === -1 ? Buffer.alloc(0) : buffer.subarray(nul + 1);
        const type = frame[0];
        if (type === PacketType.Auth) {
          const password = stripNuls(frame.subarray(1)).toString("utf8");
          const body = password === this.password ? "Password Accepted" : "Incorrect Password";
          authenticated = password === this.password;
          socket.write(Buffer.concat([Buffer.from(body, "utf8"), Buffer.from([PacketTerminator])]));
          continue;
        }
        if (type === PacketType.ExecCommand) {
          if (!authenticated) {
            socket.write(Buffer.from("Unauthenticated\0"));
            continue;
          }
          const opcode = frame[1] ?? 0;
          const args = stripNuls(frame.subarray(2)).toString("utf8");
          const custom = this.onCommand?.(opcode, args);
          if (custom !== undefined) {
            socket.write(Buffer.concat([Buffer.from(custom, "utf8"), Buffer.from([PacketTerminator])]));
            continue;
          }
          if (this.silentCommands) {
            continue;
          }
          socket.write(
            Buffer.concat([
              Buffer.from(`[2026.01.01-00.00.00:000] Response opcode=${opcode} args=${args}`, "utf8"),
              Buffer.from([PacketTerminator]),
            ]),
          );
        }
      }
    });
  }
}

function stripNuls(buffer: Buffer): Buffer {
  let end = buffer.length;
  while (end > 0 && buffer[end - 1] === PacketTerminator) {
    end -= 1;
  }
  return buffer.subarray(0, end);
}

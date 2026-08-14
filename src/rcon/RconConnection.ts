import { Socket } from "node:net";
import { RconParser } from "./RconParser.js";
import { evrimaProtocol } from "./EvrimaRconProtocol.js";
import {
  RconAuthenticationError,
  RconConnectionError,
  RconTimeoutError,
} from "./RconErrors.js";
import type { DecodedPacket } from "./RconPacket.js";

export interface ConnectionOptions {
  host: string;
  port: number;
  connectTimeoutMs: number;
  responseIdleMs: number;
}

export type DataHandler = (packet: DecodedPacket) => void;

/**
 * TCP transport only. No RCON command semantics live here.
 */
export class RconConnection {
  private socket: Socket | undefined;
  private readonly parser = new RconParser();
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private connectTimer: ReturnType<typeof setTimeout> | undefined;
  private dataHandler: DataHandler | undefined;
  private closeHandler: ((reason?: string) => void) | undefined;
  private errorHandler: ((error: Error) => void) | undefined;
  private connected = false;

  constructor(private readonly options: ConnectionOptions) {}

  isConnected(): boolean {
    return this.connected && this.socket !== undefined && !this.socket.destroyed;
  }

  onData(handler: DataHandler): void {
    this.dataHandler = handler;
  }

  onClose(handler: (reason?: string) => void): void {
    this.closeHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  async connect(): Promise<void> {
    if (this.isConnected()) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const socket = new Socket();
      this.socket = socket;

      const fail = (error: Error): void => {
        this.clearConnectTimer();
        this.destroySocket();
        reject(error);
      };

      this.connectTimer = setTimeout(() => {
        fail(
          new RconTimeoutError(`TCP connect timed out after ${this.options.connectTimeoutMs}ms`, {
            timeout: this.options.connectTimeoutMs,
            host: this.options.host,
            port: this.options.port,
          }),
        );
      }, this.options.connectTimeoutMs);

      socket.once("error", (error: Error) => {
        fail(
          new RconConnectionError(`TCP connection failed: ${error.message}`, {
            host: this.options.host,
            port: this.options.port,
            reason: error.message,
          }),
        );
      });

      socket.connect(this.options.port, this.options.host, () => {
        this.clearConnectTimer();
        this.connected = true;
        this.bindRuntimeHandlers(socket);
        resolve();
      });
    });
  }

  async write(packet: Buffer): Promise<void> {
    const socket = this.requireSocket();
    await new Promise<void>((resolve, reject) => {
      socket.write(packet, (error) => {
        if (error) {
          reject(
            new RconConnectionError(`Failed to write RCON packet: ${error.message}`, {
              reason: error.message,
            }),
          );
          return;
        }
        resolve();
      });
    });
  }

  flushIdle(): DecodedPacket | undefined {
    return this.parser.flushRemaining();
  }

  disconnect(reason = "client_disconnect"): void {
    this.clearIdleTimer();
    this.clearConnectTimer();
    this.parser.reset();
    const wasConnected = this.connected;
    this.destroySocket();
    if (wasConnected) {
      this.closeHandler?.(reason);
    }
  }

  private bindRuntimeHandlers(socket: Socket): void {
    socket.on("data", (chunk: Buffer) => {
      this.clearIdleTimer();
      const packets = evrimaProtocol.parsePackets(this.parser, chunk);
      for (const packet of packets) {
        this.dataHandler?.(packet);
      }
      if (this.parser.hasRemaining()) {
        this.idleTimer = setTimeout(() => {
          const leftover = this.parser.flushRemaining();
          if (leftover) {
            this.dataHandler?.(leftover);
          }
        }, this.options.responseIdleMs);
      }
    });

    socket.on("error", (error: Error) => {
      this.errorHandler?.(
        new RconConnectionError(`Socket error: ${error.message}`, {
          reason: error.message,
          host: this.options.host,
          port: this.options.port,
        }),
      );
    });

    socket.on("close", () => {
      const wasConnected = this.connected;
      this.connected = false;
      this.clearIdleTimer();
      this.parser.reset();
      this.socket = undefined;
      if (wasConnected) {
        this.closeHandler?.("socket_close");
      }
    });
  }

  private requireSocket(): Socket {
    if (!this.socket || this.socket.destroyed || !this.connected) {
      throw new RconConnectionError("RCON socket is not connected");
    }
    return this.socket;
  }

  private destroySocket(): void {
    this.connected = false;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = undefined;
    }
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = undefined;
    }
  }

  private clearConnectTimer(): void {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = undefined;
    }
  }
}

export function assertAuthenticatedResponse(body: string, host: string, port: number): void {
  if (evrimaProtocol.isAuthSuccess(body)) {
    return;
  }
  if (evrimaProtocol.isAuthFailure(body)) {
    throw new RconAuthenticationError("RCON authentication failed", {
      reason: "incorrect_password",
      host,
      port,
      response: body,
    });
  }
  throw new RconAuthenticationError("Unexpected RCON authentication response", {
    reason: "unexpected_auth_response",
    host,
    port,
    response: body,
  });
}

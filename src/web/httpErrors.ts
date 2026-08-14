import type { FastifyReply } from "fastify";
import { isRconError } from "../rcon/RconErrors.js";

export function sendError(reply: FastifyReply, statusCode: number, error: string, details?: unknown): void {
  void reply.code(statusCode).send({
    ok: false,
    error,
    details: details instanceof Error ? details.message : details,
  });
}

export function sendCaughtError(reply: FastifyReply, error: unknown): void {
  if (isRconError(error)) {
    const status =
      error.name === "RconAuthenticationError"
        ? 401
        : error.name === "RconUnsupportedCommandError"
          ? 400
          : error.name === "RconTimeoutError"
            ? 504
            : 502;
    sendError(reply, status, error.message, error.metadata);
    return;
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  sendError(reply, 500, message);
}

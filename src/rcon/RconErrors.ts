export interface RconErrorMetadata {
  requestId?: number;
  command?: string;
  reason?: string;
  timeout?: number;
  response?: string;
  host?: string;
  port?: number;
}

export class RconError extends Error {
  readonly metadata: RconErrorMetadata;

  constructor(message: string, metadata: RconErrorMetadata = {}) {
    super(message);
    this.name = "RconError";
    this.metadata = metadata;
  }
}

export class RconConnectionError extends RconError {
  constructor(message: string, metadata: RconErrorMetadata = {}) {
    super(message, metadata);
    this.name = "RconConnectionError";
  }
}

export class RconAuthenticationError extends RconError {
  constructor(message: string, metadata: RconErrorMetadata = {}) {
    super(message, metadata);
    this.name = "RconAuthenticationError";
  }
}

export class RconTimeoutError extends RconError {
  constructor(message: string, metadata: RconErrorMetadata = {}) {
    super(message, metadata);
    this.name = "RconTimeoutError";
  }
}

export class RconProtocolError extends RconError {
  constructor(message: string, metadata: RconErrorMetadata = {}) {
    super(message, metadata);
    this.name = "RconProtocolError";
  }
}

export class RconCommandError extends RconError {
  constructor(message: string, metadata: RconErrorMetadata = {}) {
    super(message, metadata);
    this.name = "RconCommandError";
  }
}

export class RconUnsupportedCommandError extends RconCommandError {
  constructor(message: string, metadata: RconErrorMetadata = {}) {
    super(message, metadata);
    this.name = "RconUnsupportedCommandError";
  }
}

export function isRconError(value: unknown): value is RconError {
  return value instanceof RconError;
}

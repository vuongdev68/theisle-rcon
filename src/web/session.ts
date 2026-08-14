import { randomBytes, timingSafeEqual } from "node:crypto";

export interface WebSession {
  token: string;
  username: string;
  role: "admin";
  createdAt: number;
  expiresAt: number;
}

export class SessionStore {
  private readonly sessions = new Map<string, WebSession>();

  constructor(private readonly ttlMs: number) {}

  create(username: string, role: "admin" = "admin"): WebSession {
    this.purgeExpired();
    const token = randomBytes(32).toString("hex");
    const now = Date.now();
    const session: WebSession = {
      token,
      username,
      role,
      createdAt: now,
      expiresAt: now + this.ttlMs,
    };
    this.sessions.set(token, session);
    return session;
  }

  get(token: string | undefined): WebSession | undefined {
    if (!token) {
      return undefined;
    }
    const session = this.sessions.get(token);
    if (!session) {
      return undefined;
    }
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(token);
      return undefined;
    }
    return session;
  }

  revoke(token: string | undefined): void {
    if (token) {
      this.sessions.delete(token);
    }
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [token, session] of this.sessions) {
      if (session.expiresAt <= now) {
        this.sessions.delete(token);
      }
    }
  }
}

export function passwordsMatch(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    const dummy = Buffer.alloc(right.length);
    timingSafeEqual(dummy, right);
    return false;
  }
  return timingSafeEqual(left, right);
}

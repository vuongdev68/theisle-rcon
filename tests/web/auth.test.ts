import { describe, expect, it } from "vitest";
import { passwordsMatch, SessionStore } from "../../src/web/session.js";
import { AuditLog } from "../../src/web/audit.js";
import { parseCookies, serializeCookie } from "../../src/web/cookies.js";

describe("web auth", () => {
  it("compares passwords in constant time and rejects mismatches", () => {
    expect(passwordsMatch("secret", "secret")).toBe(true);
    expect(passwordsMatch("secret", "wrong")).toBe(false);
    expect(passwordsMatch("ab", "abcd")).toBe(false);
  });

  it("issues and expires sessions", () => {
    const store = new SessionStore(50);
    const session = store.create("admin");
    expect(store.get(session.token)?.username).toBe("admin");
    expect(store.get(session.token)?.role).toBe("admin");
    store.revoke(session.token);
    expect(store.get(session.token)).toBeUndefined();
  });
});

describe("cookies", () => {
  it("parses and serializes the session cookie", () => {
    const header = serializeCookie("evrima_session", "abc123", { maxAgeMs: 1000 });
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Strict");
    const parsed = parseCookies("evrima_session=abc123; other=1");
    expect(parsed.evrima_session).toBe("abc123");
  });
});

describe("audit log", () => {
  it("records newest first and keeps unknown details", () => {
    const log = new AuditLog(2);
    log.record({ actor: "admin", role: "admin", action: "kick", target: "1", success: true });
    log.record({ actor: "admin", role: "admin", action: "ban", success: false, detail: "timeout" });
    log.record({ actor: "admin", role: "admin", action: "announce", success: true });
    const entries = log.list();
    expect(entries).toHaveLength(2);
    expect(entries[0]?.action).toBe("announce");
    expect(entries[1]?.detail).toBe("timeout");
  });
});

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  inspectPersistenceFile,
  SQLITE_MAGIC,
} from "../../src/db/persistenceInspect.js";

describe("inspectPersistenceFile", () => {
  it("classifies a missing file", () => {
    const result = inspectPersistenceFile(join(tmpdir(), "evrima-missing-persistence.db"));
    expect(result.kind).toBe("missing");
    expect(result.exists).toBe(false);
  });

  it("classifies plaintext sqlite by magic header", () => {
    const dir = mkdtempSync(join(tmpdir(), "evrima-sqlite-"));
    const path = join(dir, "plain.db");
    const page = Buffer.alloc(1024, 0);
    SQLITE_MAGIC.copy(page);
    writeFileSync(path, page);
    const result = inspectPersistenceFile(path);
    expect(result.kind).toBe("sqlite");
    expect(result.size).toBe(1024);
  });

  it("classifies high-entropy blobs as encrypted-or-unknown", () => {
    const dir = mkdtempSync(join(tmpdir(), "evrima-enc-"));
    const path = join(dir, "enc.db");
    const blob = Buffer.alloc(4096);
    for (let i = 0; i < blob.length; i += 1) {
      blob[i] = (i * 37 + 13) % 256;
    }
    writeFileSync(path, blob);
    const result = inspectPersistenceFile(path);
    expect(result.kind).toBe("encrypted-or-unknown");
    expect(result.entropyBits).toBeGreaterThan(7);
  });
});

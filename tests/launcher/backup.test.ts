import { mkdirSync, mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BackupService } from "../../src/services/BackupService.js";

describe("BackupService.delete", () => {
  it("removes a listed backup and rejects path tricks", () => {
    const root = mkdtempSync(join(tmpdir(), "isle-bak-"));
    mkdirSync(join(root, "Backups"), { recursive: true });
    const name = "SavedBackup_2026-08-17T01-56-06.tar.gz";
    writeFileSync(join(root, "Backups", name), "x");
    const backups = new BackupService(root);
    backups.delete(name);
    expect(existsSync(join(root, "Backups", name))).toBe(false);
    expect(() => backups.delete("../secret.tar.gz")).toThrow("Invalid backup name");
    expect(() => backups.delete("SavedBackup_missing.tar.gz")).toThrow("Backup not found");
  });

  it("is not usable without a Saved folder", () => {
    expect(new BackupService("").usable).toBe(false);
    const root = mkdtempSync(join(tmpdir(), "isle-bak-empty-"));
    expect(new BackupService(root).usable).toBe(false);
  });
});

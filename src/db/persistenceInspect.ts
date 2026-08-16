import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

export const SQLITE_MAGIC = Buffer.from("SQLite format 3\0", "utf8");

export type PersistenceKind = "missing" | "empty" | "sqlite" | "encrypted-or-unknown";

export interface PersistenceInspectResult {
  path: string;
  exists: boolean;
  size: number;
  kind: PersistenceKind;
  headerHex: string;
  headerAscii: string;
  entropyBits: number;
  sqlitePageHint: number | null;
  notes: string[];
}

export function defaultPersistencePath(cwd = process.cwd()): string {
  const fromEnv = process.env.ISLE_PERSISTENCE_DB?.trim();
  if (fromEnv) {
    return resolve(cwd, fromEnv);
  }
  return resolve(cwd, "src/db/TheIslePersistence.db");
}

export function inspectPersistenceFile(filePath: string): PersistenceInspectResult {
  const path = resolve(filePath);
  if (!existsSync(path)) {
    return {
      path,
      exists: false,
      size: 0,
      kind: "missing",
      headerHex: "",
      headerAscii: "",
      entropyBits: 0,
      sqlitePageHint: null,
      notes: ["File does not exist."],
    };
  }

  const size = statSync(path).size;
  if (size === 0) {
    return {
      path,
      exists: true,
      size: 0,
      kind: "empty",
      headerHex: "",
      headerAscii: "",
      entropyBits: 0,
      sqlitePageHint: null,
      notes: ["File is empty."],
    };
  }

  const sample = readFileSync(path);
  const header = sample.subarray(0, 64);
  const entropyBits = shannonEntropy(sample.subarray(0, Math.min(sample.length, 65_536)));
  const sqlite = sample.subarray(0, SQLITE_MAGIC.length).equals(SQLITE_MAGIC);
  const pageHint = size % 4096 === 0 ? 4096 : size % 1024 === 0 ? 1024 : null;

  const notes: string[] = [];
  let kind: PersistenceKind;
  if (sqlite) {
    kind = "sqlite";
    notes.push("Plain SQLite header found. Tables can be queried.");
  } else {
    kind = "encrypted-or-unknown";
    notes.push(
      "Not a plaintext SQLite database (missing \"SQLite format 3\" magic). Node sqlite3 cannot open it.",
    );
    if (entropyBits >= 7.5) {
      notes.push(
        "Byte entropy is high (~random). This matches an encrypted SQLite/SQLCipher page file, not JSON player saves.",
      );
    }
    if (pageHint) {
      notes.push(`File size ${size} is a multiple of ${pageHint} (typical SQLite page size).`);
    }
    notes.push(
      "Evrima player dino records are usually TheIsle/Saved/PlayerData/<SteamID>, not this encrypted blob.",
    );
    notes.push("Do not brute-force a key. Copy PlayerData files or a decrypted DB if the game ever writes one.");
  }

  return {
    path,
    exists: true,
    size,
    kind,
    headerHex: header.toString("hex"),
    headerAscii: toPrintableAscii(header),
    entropyBits: Number(entropyBits.toFixed(3)),
    sqlitePageHint: pageHint,
    notes,
  };
}

export function formatInspectResult(result: PersistenceInspectResult): string {
  const lines = [
    `path: ${result.path}`,
    `exists: ${result.exists}`,
    `size: ${result.size}`,
    `kind: ${result.kind}`,
    `entropy: ${result.entropyBits} bits/byte`,
    `header: ${result.headerAscii}`,
    `hex: ${result.headerHex}`,
  ];
  if (result.sqlitePageHint) {
    lines.push(`page-size hint: ${result.sqlitePageHint}`);
  }
  for (const note of result.notes) {
    lines.push(`- ${note}`);
  }
  return lines.join("\n");
}

function shannonEntropy(bytes: Buffer): number {
  if (bytes.length === 0) {
    return 0;
  }
  const counts = new Array<number>(256).fill(0);
  for (const value of bytes) {
    counts[value] += 1;
  }
  let entropy = 0;
  for (const count of counts) {
    if (count === 0) {
      continue;
    }
    const p = count / bytes.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function toPrintableAscii(bytes: Buffer): string {
  return [...bytes]
    .map((value) => (value >= 32 && value < 127 ? String.fromCharCode(value) : "."))
    .join("");
}

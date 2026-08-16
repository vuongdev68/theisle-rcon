export interface SqliteTableDump {
  name: string;
  columns: string[];
  rowCount: number;
  sample: Record<string, unknown>[];
}

export type SqliteDumpResult =
  | { ok: true; tables: SqliteTableDump[] }
  | { ok: false; reason: string };

interface SqliteDatabase {
  prepare(sql: string): {
    all: (...args: unknown[]) => unknown[];
    get: (...args: unknown[]) => unknown;
  };
  close(): void;
}

interface SqliteModule {
  DatabaseSync: new (path: string, options?: { readOnly?: boolean }) => SqliteDatabase;
}

/**
 * Dump tables from a plaintext SQLite file.
 * Uses Node's built-in `node:sqlite` when available (Node 22.13+).
 */
export async function tryDumpSqliteTables(filePath: string, sampleRows = 3): Promise<SqliteDumpResult> {
  let sqlite: SqliteModule;
  try {
    sqlite = (await import("node:sqlite")) as SqliteModule;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: `node:sqlite is not available: ${message}` };
  }

  let db: SqliteDatabase;
  try {
    db = new sqlite.DatabaseSync(filePath, { readOnly: true });
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }

  try {
    const tableRows = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as Array<{ name: string }>;
    const tables: SqliteTableDump[] = [];
    for (const { name } of tableRows) {
      const quoted = quoteIdent(name);
      const info = db.prepare(`PRAGMA table_info(${quoted})`).all() as Array<{ name: string }>;
      const countRow = db.prepare(`SELECT COUNT(*) AS n FROM ${quoted}`).get() as { n: number } | undefined;
      const sample = (db.prepare(`SELECT * FROM ${quoted} LIMIT ?`).all(sampleRows) as Array<
        Record<string, unknown>
      >).map(sanitizeRow);
      tables.push({
        name,
        columns: info.map((column) => column.name),
        rowCount: Number(countRow?.n ?? 0),
        sample,
      });
    }
    return { ok: true, tables };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  } finally {
    db.close();
  }
}

function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Uint8Array) {
      out[key] = `<blob ${value.byteLength} bytes>`;
    } else {
      out[key] = value;
    }
  }
  return out;
}

#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { defaultPersistencePath, formatInspectResult, inspectPersistenceFile } from "../db/persistenceInspect.js";
import { tryDumpSqliteTables } from "../db/sqliteDump.js";

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const filePath = argv[0] ?? defaultPersistencePath();
  const inspect = inspectPersistenceFile(filePath);
  process.stdout.write(`${formatInspectResult(inspect)}\n`);

  if (inspect.kind !== "sqlite") {
    process.exitCode = inspect.exists ? 2 : 1;
    return;
  }

  const dump = await tryDumpSqliteTables(inspect.path);
  if (!dump.ok) {
    process.stdout.write(`\nsqlite dump skipped: ${dump.reason}\n`);
    return;
  }

  process.stdout.write("\n=== tables ===\n");
  for (const table of dump.tables) {
    process.stdout.write(`${table.name}: ${table.rowCount} rows\n`);
    process.stdout.write(`  columns: ${table.columns.join(", ")}\n`);
    for (const row of table.sample) {
      process.stdout.write(`  sample: ${JSON.stringify(row)}\n`);
    }
  }
}

const invoked = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invoked) {
  await main();
}

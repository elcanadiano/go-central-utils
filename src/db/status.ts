import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeDb, sql } from "./client.js";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

async function status(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const appliedRows = await sql<{ id: string; applied_at: Date }[]>`
    SELECT id, applied_at FROM schema_migrations ORDER BY id
  `;
  const applied = new Map(appliedRows.map((row) => [row.id, row.applied_at]));

  const files = (await readdir(migrationsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No migration files found.");
    return;
  }

  for (const file of files) {
    const at = applied.get(file);
    if (at) {
      console.log(`✓ ${file}  (applied ${at.toISOString()})`);
    } else {
      console.log(`○ ${file}  (pending)`);
    }
  }
}

try {
  await status();
} finally {
  await closeDb();
}

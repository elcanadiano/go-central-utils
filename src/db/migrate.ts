import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeDb, sql } from "./client.js";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

async function ensureMigrationsTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

async function appliedMigrations(): Promise<Set<string>> {
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM schema_migrations ORDER BY id
  `;
  return new Set(rows.map((row) => row.id));
}

async function listMigrationFiles(): Promise<string[]> {
  const entries = await readdir(migrationsDir);
  return entries.filter((name) => name.endsWith(".sql")).sort();
}

async function migrate(): Promise<void> {
  await ensureMigrationsTable();

  const applied = await appliedMigrations();
  const files = await listMigrationFiles();
  let ran = 0;

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const fullPath = path.join(migrationsDir, file);
    const body = await readFile(fullPath, "utf8");

    console.log(`Applying ${file}...`);

    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`
        INSERT INTO schema_migrations (id) VALUES (${file})
      `;
    });

    ran += 1;
    console.log(`Applied ${file}`);
  }

  if (ran === 0) {
    console.log("No pending migrations.");
  } else {
    console.log(`Applied ${ran} migration(s).`);
  }
}

try {
  await migrate();
} finally {
  await closeDb();
}

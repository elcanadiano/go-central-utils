import "dotenv/config";
import postgres from "postgres";

function isLocalHost(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local")
  );
}

function createSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return postgres(databaseUrl, {
      ssl: "require",
    });
  }

  const host = process.env.PGHOST;
  const port = process.env.PGPORT;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;
  const database = process.env.PGDATABASE;

  const missing = (
    [
      ["PGHOST", host],
      ["PGPORT", port],
      ["PGUSER", user],
      ["PGPASSWORD", password],
      ["PGDATABASE", database],
    ] as const
  ).filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(
      `Missing env vars: ${missing.map(([name]) => name).join(", ")} (or set DATABASE_URL). Copy .env.example to .env and fill in credentials.`,
    );
  }

  return postgres({
    host,
    port: Number(port),
    user,
    password,
    database,
    ssl: isLocalHost(host!) ? undefined : "require",
  });
}

export const sql = createSql();

export async function closeDb(): Promise<void> {
  await sql.end();
}

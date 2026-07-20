import "dotenv/config";
import postgres from "postgres";

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
    `Missing env vars: ${missing.map(([name]) => name).join(", ")}. Copy .env.example to .env and fill in credentials.`,
  );
}

export const sql = postgres({
  host,
  port: Number(port),
  user,
  password,
  database,
});

export async function closeDb(): Promise<void> {
  await sql.end();
}

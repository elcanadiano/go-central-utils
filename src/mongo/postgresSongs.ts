import { rangeSize } from "./range.js";
import type { IntRange } from "./types.js";

const MAX_SONG_ID_RANGE = 10_000;

function canUsePostgres(): boolean {
  if (process.env.DATABASE_URL?.trim()) {
    return true;
  }

  return Boolean(
    process.env.PGHOST &&
      process.env.PGPORT &&
      process.env.PGUSER &&
      process.env.PGPASSWORD &&
      process.env.PGDATABASE,
  );
}

export async function loadSongIdsFromPostgres(): Promise<number[] | null> {
  if (!canUsePostgres()) {
    return null;
  }

  const { closeDb, sql } = await import("../db/client.js");
  try {
    const rows = await sql<{ song_id_number: number | bigint }[]>`
      SELECT song_id_number FROM songs
    `;
    return rows.map((row) => Number(row.song_id_number));
  } finally {
    await closeDb();
  }
}

export async function resolveSongIds(range?: IntRange): Promise<number[]> {
  if (range) {
    const size = rangeSize(range);
    if (size > MAX_SONG_ID_RANGE) {
      throw new Error(
        `--song-id ${range.min}-${range.max} covers ${size} IDs. Use a range of at most ${MAX_SONG_ID_RANGE}, or omit --song-id to read IDs from Postgres.`,
      );
    }
    const ids: number[] = [];
    for (let id = range.min; id <= range.max; id += 1) {
      ids.push(id);
    }
    return ids;
  }

  console.log("No --song-id given; loading song IDs from Postgres...");
  const fromPostgres = await loadSongIdsFromPostgres();
  if (fromPostgres && fromPostgres.length > 0) {
    console.log(`Loaded ${fromPostgres.length} song ID(s) from Postgres.`);
    return fromPostgres;
  }

  throw new Error(
    "--song-id is required (use N or N-M), or configure Postgres so song IDs can be read from the songs table.",
  );
}

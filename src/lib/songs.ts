import { sql } from "../db/client.js";

export type SongRow = {
  song_id_number: number;
  song_id: string | null;
  album: string | null;
  album2: string | null;
  artist: string | null;
  artist2: string | null;
  genre: string | null;
  name: string | null;
  name2: string | null;
};

export const SONG_COLUMNS = [
  "song_id_number",
  "song_id",
  "album",
  "album2",
  "artist",
  "artist2",
  "genre",
  "name",
  "name2",
] as const;

const BATCH_SIZE = 500;

export async function upsertBatch(rows: SongRow[]): Promise<void> {
  await sql`
    INSERT INTO songs ${sql(rows, ...SONG_COLUMNS)}
    ON CONFLICT (song_id_number) DO UPDATE SET
      song_id = EXCLUDED.song_id,
      album = EXCLUDED.album,
      album2 = EXCLUDED.album2,
      artist = EXCLUDED.artist,
      artist2 = EXCLUDED.artist2,
      genre = EXCLUDED.genre,
      name = EXCLUDED.name,
      name2 = EXCLUDED.name2
  `;
}

/** Upsert songs in batches, logging progress. */
export async function upsertSongs(rows: SongRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await upsertBatch(batch);
    console.log(`Upserted ${Math.min(i + BATCH_SIZE, rows.length)} / ${rows.length}`);
  }
}

import { readFile } from "node:fs/promises";
import path from "node:path";
import { closeDb, sql } from "../db/client.js";
import { mapDtaGenre } from "../lib/dtaGenres.js";
import { extractDtaSongs, parseDta } from "../lib/parseDta.js";
import { toSortTitle } from "../lib/toSortTitle.js";

type SongRow = {
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

const COLUMNS = [
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

function sortTitleOrNull(value: string | null): string | null {
  return value == null ? null : toSortTitle(value);
}

async function upsertBatch(rows: SongRow[]): Promise<void> {
  await sql`
    INSERT INTO songs ${sql(rows, ...COLUMNS)}
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

async function importSongsDta(filePath: string): Promise<void> {
  const absolutePath = path.resolve(filePath);
  const raw = await readFile(absolutePath, "utf8");
  const parsed = parseDta(raw);
  const songs = extractDtaSongs(parsed);

  const byId = new Map<number, SongRow>();
  let duplicateCount = 0;

  for (const song of songs) {
    if (byId.has(song.songIdNumber)) {
      duplicateCount += 1;
      console.warn(
        `Duplicate song_id ${song.songIdNumber}: keeping slug "${song.songId}" (last write wins)`,
      );
    }

    byId.set(song.songIdNumber, {
      song_id_number: song.songIdNumber,
      song_id: song.songId,
      album: song.album,
      album2: sortTitleOrNull(song.album),
      artist: song.artist,
      artist2: sortTitleOrNull(song.artist),
      genre: mapDtaGenre(song.genre),
      name: song.name,
      name2: sortTitleOrNull(song.name),
    });
  }

  const rows = [...byId.values()];
  console.log(
    `Importing ${rows.length} song(s) from ${absolutePath}` +
      (duplicateCount > 0 ? ` (${duplicateCount} duplicate song_id(s) collapsed)` : "") +
      "...",
  );

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await upsertBatch(batch);
    console.log(`Upserted ${Math.min(i + BATCH_SIZE, rows.length)} / ${rows.length}`);
  }

  console.log("Done.");
}

const fileArg = process.argv[2];

if (!fileArg) {
  console.error("Usage: pnpm import:songs-dta <path-to-song_map.dta>");
  process.exit(1);
}

try {
  await importSongsDta(fileArg);
} finally {
  await closeDb();
}

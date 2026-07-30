import { readFile } from "node:fs/promises";
import path from "node:path";
import { closeDb } from "../db/client.js";
import { mapDtaGenre } from "../lib/dtaGenres.js";
import { extractDtaSongs, parseDta } from "../lib/parseDta.js";
import { type SongRow, parseSongImportArgs, upsertSongs } from "../lib/songs.js";
import { toSortTitle } from "../lib/toSortTitle.js";

function sortTitleOrNull(value: string | null): string | null {
  return value == null ? null : toSortTitle(value);
}

async function importSongsDta(
  filePath: string,
  options: { doNothing: boolean },
): Promise<void> {
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
  const mode = options.doNothing ? "do-nothing" : "upsert";
  console.log(
    `Importing ${rows.length} song(s) from ${absolutePath} (${mode})` +
      (duplicateCount > 0 ? ` (${duplicateCount} duplicate song_id(s) collapsed)` : "") +
      "...",
  );
  await upsertSongs(rows, options);
  console.log("Done.");
}

const { filePath, doNothing } = parseSongImportArgs(process.argv.slice(2));

if (!filePath) {
  console.error(
    "Usage: pnpm import:songs-dta <path-to-song_map.dta> [-dn|--do-nothing]",
  );
  process.exit(1);
}

try {
  await importSongsDta(filePath, { doNothing });
} finally {
  await closeDb();
}

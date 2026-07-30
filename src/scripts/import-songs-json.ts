import { readFile } from "node:fs/promises";
import path from "node:path";
import { closeDb } from "../db/client.js";
import { type SongRow, upsertSongs } from "../lib/songs.js";

function asNullableString(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return String(value);
}

function mapSong(raw: unknown, index: number): SongRow {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Item at index ${index} is not an object`);
  }

  const obj = raw as Record<string, unknown>;
  const songIdNumber = obj.SongIDNumber;

  if (typeof songIdNumber !== "number" || !Number.isInteger(songIdNumber)) {
    throw new Error(
      `Item at index ${index} is missing a valid integer SongIDNumber`,
    );
  }

  return {
    song_id_number: songIdNumber,
    song_id: asNullableString(obj.SongID),
    album: asNullableString(obj.Album),
    album2: asNullableString(obj.Album2),
    artist: asNullableString(obj.Artist),
    artist2: asNullableString(obj.Artist2),
    genre: asNullableString(obj.Genre),
    name: asNullableString(obj.Name),
    name2: asNullableString(obj.Name2),
  };
}

async function importSongs(filePath: string): Promise<void> {
  const absolutePath = path.resolve(filePath);
  const raw = await readFile(absolutePath, "utf8");
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("JSON root must be an array of song objects");
  }

  const rows = parsed.map((item, index) => mapSong(item, index));
  console.log(`Importing ${rows.length} song(s) from ${absolutePath}...`);
  await upsertSongs(rows);
  console.log("Done.");
}

const fileArg = process.argv[2];

if (!fileArg) {
  console.error("Usage: pnpm import:songs-json <path-to-songs.json>");
  process.exit(1);
}

try {
  await importSongs(fileArg);
} finally {
  await closeDb();
}

import "dotenv/config";
import { closeDb } from "../db/client.js";
import {
  type SongRow,
  confirmSongsApiUpsert,
  parseSongsApiImportArgs,
  upsertSongs,
} from "../lib/songs.js";

type SongListResponse = {
  songs: number[];
};

function requireApiBaseUrl(): string {
  const baseUrl = process.env.GOCENTRAL_API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error(
      "GOCENTRAL_API_BASE_URL is not set. Copy .env.example to .env and fill in the API base URL.",
    );
  }
  return baseUrl.replace(/\/+$/, "");
}

function parseSongList(payload: unknown): number[] {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("song_list response must be an object");
  }

  const songs = (payload as SongListResponse).songs;
  if (!Array.isArray(songs)) {
    throw new Error("song_list response missing a songs array");
  }

  const ids: number[] = [];
  for (const [index, value] of songs.entries()) {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new Error(`songs[${index}] is not an integer song id`);
    }
    ids.push(value);
  }

  return ids;
}

async function fetchSongIds(baseUrl: string): Promise<number[]> {
  const url = `${baseUrl}/song_list`;
  console.log(`Fetching ${url}...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`song_list request failed: ${response.status} ${response.statusText}`);
  }

  return parseSongList(await response.json());
}

async function importSongsApi(options: {
  doNothing: boolean;
  yes: boolean;
}): Promise<void> {
  const baseUrl = requireApiBaseUrl();

  const confirmed = await confirmSongsApiUpsert(options);
  if (!confirmed) {
    console.error("Aborted.");
    process.exitCode = 1;
    return;
  }

  const songIds = await fetchSongIds(baseUrl);
  const uniqueIds = [...new Set(songIds)];

  const rows: SongRow[] = uniqueIds.map((songIdNumber) => ({
    song_id_number: songIdNumber,
    song_id: null,
    album: null,
    album2: null,
    artist: null,
    artist2: null,
    genre: null,
    name: null,
    name2: null,
  }));

  const mode = options.doNothing ? "do-nothing" : "upsert";
  console.log(
    `Importing ${rows.length} song id(s) from GoCentral API (${mode})` +
      (uniqueIds.length !== songIds.length
        ? ` (${songIds.length - uniqueIds.length} duplicate id(s) collapsed)`
        : "") +
      "...",
  );

  await upsertSongs(rows, { doNothing: options.doNothing });
  console.log("Done.");
}

const { doNothing, yes } = parseSongsApiImportArgs(process.argv.slice(2));

try {
  await importSongsApi({ doNothing, yes });
} finally {
  await closeDb();
}

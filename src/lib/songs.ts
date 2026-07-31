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

export type UpsertSongsOptions = {
  /** If true, skip existing rows instead of updating them. */
  doNothing?: boolean;
};

const BATCH_SIZE = 500;

export async function upsertBatch(
  rows: SongRow[],
  options: UpsertSongsOptions = {},
): Promise<void> {
  if (options.doNothing) {
    await sql`
      INSERT INTO songs ${sql(rows, ...SONG_COLUMNS)}
      ON CONFLICT (song_id_number) DO NOTHING
    `;
    return;
  }

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

/**
 * Delete existing rows that share a song_id slug with an incoming row but use a
 * different song_id_number (e.g. JSON catalog IDs superseded by DTA).
 * Returns the removed rows.
 */
export async function removeConflictingSongIds(
  rows: SongRow[],
): Promise<{ song_id_number: number; song_id: string }[]> {
  const incoming = rows.filter(
    (row): row is SongRow & { song_id: string } => row.song_id != null,
  );

  if (incoming.length === 0) {
    return [];
  }

  const deleted: { song_id_number: number; song_id: string }[] = [];

  for (let i = 0; i < incoming.length; i += BATCH_SIZE) {
    const batch = incoming.slice(i, i + BATCH_SIZE);
    const pairs = batch.map((row) => [row.song_id, row.song_id_number]);

    const batchDeleted = await sql<{ song_id_number: number; song_id: string }[]>`
      DELETE FROM songs AS s
      USING (VALUES ${sql(pairs)}) AS incoming(song_id, song_id_number)
      WHERE s.song_id = incoming.song_id::text
        AND s.song_id_number IS DISTINCT FROM incoming.song_id_number::bigint
      RETURNING s.song_id_number, s.song_id
    `;

    deleted.push(...batchDeleted);
  }

  return deleted;
}

/** Upsert songs in batches, logging progress. */
export async function upsertSongs(
  rows: SongRow[],
  options: UpsertSongsOptions = {},
): Promise<void> {
  const action = options.doNothing ? "Inserted" : "Upserted";

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await upsertBatch(batch, options);
    console.log(`${action} ${Math.min(i + BATCH_SIZE, rows.length)} / ${rows.length}`);
  }
}

/** Parse shared import CLI flags: `<file> [-dn|--do-nothing]` */
export function parseSongImportArgs(argv: string[]): {
  filePath: string | undefined;
  doNothing: boolean;
} {
  const doNothing = argv.includes("-dn") || argv.includes("--do-nothing");
  const filePath = argv.find((arg) => !arg.startsWith("-"));
  return { filePath, doNothing };
}

/** Parse API import CLI flags: `[-dn|--do-nothing] [-y|--yes]` */
export function parseSongsApiImportArgs(argv: string[]): {
  doNothing: boolean;
  yes: boolean;
} {
  return {
    doNothing: argv.includes("-dn") || argv.includes("--do-nothing"),
    yes: argv.includes("-y") || argv.includes("--yes"),
  };
}

/**
 * Guard for dangerous API upserts that can null out existing metadata.
 * Returns true if the import should proceed.
 */
export async function confirmSongsApiUpsert(options: {
  doNothing: boolean;
  yes: boolean;
}): Promise<boolean> {
  if (options.doNothing) {
    return true;
  }

  const warning = [
    "WARNING: Running without --do-nothing will upsert song_id_number rows",
    "and may clear existing song_id / name / artist / album / genre fields",
    "for IDs already in the database.",
  ].join("\n");

  console.warn(warning);

  if (options.yes) {
    console.warn("Continuing because --yes was passed.");
    return true;
  }

  if (!process.stdin.isTTY) {
    console.error(
      "Refusing upsert in non-interactive mode. Pass -dn/--do-nothing or -y/--yes.",
    );
    return false;
  }

  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await rl.question("Continue? [y/N] ");
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

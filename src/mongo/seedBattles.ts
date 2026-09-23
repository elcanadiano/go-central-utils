import { getMongo } from "./client.js";
import { nextCounter } from "./counters.js";
import { pickFromRange, sampleUnique, warnShortfall } from "./range.js";
import { resolveSongIds } from "./postgresSongs.js";
import type { IntRange, SeedBattle, SeedInsertResult } from "./types.js";
import { logWipe, wipeBattles as wipeBattleDocs } from "./wipe.js";

const INSERT_BATCH = 500;
const DEFAULT_DURATION_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_SONGS_PER_BATTLE: IntRange = { min: 1, max: 3 };

export async function seedBattles(options: {
  count: number;
  songId?: IntRange;
  songsPerBattle?: IntRange;
  instrument?: IntRange;
  durationSeconds?: IntRange;
  title?: string;
  desc?: string;
}): Promise<SeedInsertResult> {
  const instrumentRange = options.instrument ?? { min: 0, max: 0 };
  if (instrumentRange.min < 0 || instrumentRange.max > 10) {
    throw new Error("--instrument must be in 0-10");
  }

  const durationRange = options.durationSeconds ?? {
    min: DEFAULT_DURATION_SECONDS,
    max: DEFAULT_DURATION_SECONDS,
  };
  if (durationRange.min <= 0) {
    throw new Error("--duration-seconds must be greater than 0");
  }

  const songPool = await resolveSongIds(options.songId);
  const songsPerBattle = options.songsPerBattle ??
    (songPool.length === 1
      ? { min: 1, max: 1 }
      : DEFAULT_SONGS_PER_BATTLE);

  if (songsPerBattle.min < 1) {
    throw new Error("--songs-per-battle must be at least 1");
  }
  if (songsPerBattle.max > songPool.length) {
    throw new Error(
      `--songs-per-battle ${songsPerBattle.max} is larger than the song pool (${songPool.length})`,
    );
  }

  const db = await getMongo();
  const setlists = db.collection("setlists");
  const existing = await setlists
    .find({}, { projection: { setlist_id: 1, _id: 0 } })
    .toArray();
  const usedIds = new Set(
    existing
      .map((doc) => doc.setlist_id)
      .filter((id): id is number => Number.isInteger(id)),
  );

  const docs: SeedBattle[] = [];
  const created = Math.floor(Date.now() / 1000);

  while (docs.length < options.count) {
    const setlistId = await nextCounter("last_setlist_id");
    if (usedIds.has(setlistId)) {
      continue;
    }
    usedIds.add(setlistId);

    const songCount = Math.min(pickFromRange(songsPerBattle), songPool.length);
    const songIds = sampleUnique(songPool, songCount);

    docs.push({
      setlist_id: setlistId,
      pid: 0,
      title: options.title ?? `seed_battle_${setlistId}`,
      desc: options.desc ?? "",
      type: 1002,
      owner: "Harmonix",
      shared: "t",
      s_ids: songIds,
      s_names: songIds.map(() => ""),
      time_end_val: pickFromRange(durationRange),
      time_end_units: "seconds",
      flags: 0,
      instrument: pickFromRange(instrumentRange),
      created,
      seed: true,
    });
  }

  for (let i = 0; i < docs.length; i += INSERT_BATCH) {
    const batch = docs.slice(i, i + INSERT_BATCH);
    await setlists.insertMany(batch);
    console.log(
      `Inserted ${Math.min(i + INSERT_BATCH, docs.length)} / ${docs.length} battles`,
    );
  }

  warnShortfall("seed:battles", options.count, docs.length);
  return { requested: options.count, inserted: docs.length };
}

export async function wipeBattles(all: boolean): Promise<number> {
  const deleted = await wipeBattleDocs({ all });
  logWipe("Harmonix battles", deleted, all);
  return deleted;
}

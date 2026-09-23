import { getMongo } from "./client.js";

const SONG_SCORE_FILTER = {
  $or: [
    { battle_id: { $exists: false } },
    { battle_id: null },
    { battle_id: 0 },
  ],
};

const BATTLE_SCORE_FILTER = {
  battle_id: { $exists: true, $gt: 0 },
};

const HARMONIX_BATTLE_FILTER = {
  type: 1002,
};

export async function wipeCollection(
  collectionName: string,
  options: { all: boolean },
): Promise<number> {
  const db = await getMongo();
  const filter = options.all ? {} : { seed: true };
  const result = await db.collection(collectionName).deleteMany(filter);
  return result.deletedCount;
}

export async function wipeSongScores(options: { all: boolean }): Promise<number> {
  const db = await getMongo();
  const filter = options.all
    ? SONG_SCORE_FILTER
    : { seed: true, ...SONG_SCORE_FILTER };
  const result = await db.collection("scores").deleteMany(filter);
  return result.deletedCount;
}

export async function wipeBattleScores(options: {
  all: boolean;
}): Promise<number> {
  const db = await getMongo();
  const filter = options.all
    ? BATTLE_SCORE_FILTER
    : { seed: true, ...BATTLE_SCORE_FILTER };
  const result = await db.collection("scores").deleteMany(filter);
  return result.deletedCount;
}

export async function wipeBattles(options: { all: boolean }): Promise<number> {
  const db = await getMongo();
  const filter = options.all
    ? HARMONIX_BATTLE_FILTER
    : { seed: true, ...HARMONIX_BATTLE_FILTER };
  const result = await db.collection("setlists").deleteMany(filter);
  return result.deletedCount;
}

export function logWipe(
  label: string,
  deleted: number,
  all: boolean,
): void {
  console.log(
    `Deleted ${deleted} ${label} document(s)${all ? " (wipe-all)" : " (seed: true)"}.`,
  );
}

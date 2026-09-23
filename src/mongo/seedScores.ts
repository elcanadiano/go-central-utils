import { getMongo } from "./client.js";
import { expandRange, pickFromRange, warnShortfall } from "./range.js";
import { resolveBandOwnerPool, resolveUserPidPool } from "./pids.js";
import { resolveSongIds } from "./postgresSongs.js";
import {
  BAND_ROLE_ID,
  DEFAULT_ROLE_RANGE,
  DEFAULT_SCORE_RANGE,
  type IntRange,
  type SeedInsertResult,
  type SeedSongScore,
} from "./types.js";
import { logWipe, wipeSongScores } from "./wipe.js";

const INSERT_BATCH = 500;

const INSTRUMENT_MASK: Record<number, number> = {
  0: 1,
  1: 2,
  2: 4,
  3: 8,
  4: 16,
  5: 32,
  6: 64,
  7: 128,
  8: 256,
  9: 512,
};

type Triple = {
  songId: number;
  roleId: number;
  pid: number;
};

function tripleKey(triple: Triple): string {
  return `${triple.songId}:${triple.roleId}:${triple.pid}`;
}

function deriveScoreFields(
  roleId: number,
  score: number,
  scoreRange: IntRange,
): Pick<
  SeedSongScore,
  "notespct" | "stars" | "diff_id" | "boi" | "instrument_mask"
> {
  const span = Math.max(1, scoreRange.max - scoreRange.min);
  const t = Math.min(1, Math.max(0, (score - scoreRange.min) / span));

  return {
    stars: 1 + Math.round(t * 5),
    notespct: Math.max(1, Math.min(100, 50 + Math.round(t * 50))),
    diff_id: Math.min(4, Math.floor(t * 5)),
    boi: roleId === BAND_ROLE_ID ? 0 : 1,
    instrument_mask:
      roleId === BAND_ROLE_ID ? 0 : (INSTRUMENT_MASK[roleId] ?? 1),
  };
}

function randomPairForSong(
  songId: number,
  nonBandRoles: number[],
  bandRoles: number[],
  userPids: number[],
  bandPids: number[],
): Triple | null {
  const useBand =
    bandRoles.length > 0 &&
    bandPids.length > 0 &&
    (nonBandRoles.length === 0 ||
      Math.random() <
        bandRoles.length / (bandRoles.length + nonBandRoles.length));

  if (useBand) {
    return {
      songId,
      roleId: bandRoles[Math.floor(Math.random() * bandRoles.length)]!,
      pid: bandPids[Math.floor(Math.random() * bandPids.length)]!,
    };
  }

  if (nonBandRoles.length === 0 || userPids.length === 0) {
    return null;
  }

  return {
    songId,
    roleId: nonBandRoles[Math.floor(Math.random() * nonBandRoles.length)]!,
    pid: userPids[Math.floor(Math.random() * userPids.length)]!,
  };
}

function sampleTriplesForSong(
  songId: number,
  count: number,
  nonBandRoles: number[],
  bandRoles: number[],
  userPids: number[],
  bandPids: number[],
  used: Set<string>,
): Triple[] {
  const triples: Triple[] = [];
  const pairSpace =
    nonBandRoles.length * userPids.length + bandRoles.length * bandPids.length;
  const maxAttempts = Math.max(count * 40, 200);
  let attempts = 0;

  while (triples.length < count && attempts < maxAttempts) {
    attempts += 1;
    if (pairSpace > 0 && attempts > pairSpace * 4 && triples.length === 0) {
      break;
    }
    const triple = randomPairForSong(
      songId,
      nonBandRoles,
      bandRoles,
      userPids,
      bandPids,
    );
    if (!triple) {
      break;
    }
    const key = tripleKey(triple);
    if (used.has(key)) {
      continue;
    }
    used.add(key);
    triples.push(triple);
  }
  return triples;
}

export async function seedScores(options: {
  count: IntRange;
  songId?: IntRange;
  roleId?: IntRange;
  pid?: IntRange;
  score?: IntRange;
}): Promise<SeedInsertResult> {
  const roleRange = options.roleId ?? DEFAULT_ROLE_RANGE;
  if (roleRange.min < 0 || roleRange.max > 10) {
    throw new Error("--role-id must be in 0-10");
  }

  const scoreRange = options.score ?? DEFAULT_SCORE_RANGE;
  if (scoreRange.min <= 0) {
    throw new Error("--score must be greater than 0");
  }

  console.log("Resolving song IDs...");
  const songIds = await resolveSongIds(options.songId);
  const roleIds = expandRange(roleRange);
  const nonBandRoles = roleIds.filter((role) => role !== BAND_ROLE_ID);
  const bandRoles = roleIds.filter((role) => role === BAND_ROLE_ID);

  console.log("Loading user PID pool...");
  const userPids =
    nonBandRoles.length > 0 ? await resolveUserPidPool(options.pid) : [];

  let bandPids: number[] = [];
  if (bandRoles.length > 0) {
    try {
      console.log("Loading band owner PID pool...");
      bandPids = await resolveBandOwnerPool(options.pid);
    } catch (error) {
      if (nonBandRoles.length === 0) {
        throw error;
      }
      console.warn(
        `${error instanceof Error ? error.message : error} Skipping role_id 10.`,
      );
    }
  }

  const db = await getMongo();
  const scores = db.collection("scores");

  const existingFilter: Record<string, unknown> = {
    song_id: { $in: songIds },
    role_id: { $in: roleIds },
  };
  const pidFilter = [...new Set([...userPids, ...bandPids])];
  if (pidFilter.length > 0 && pidFilter.length < 10_000) {
    existingFilter.pid = { $in: pidFilter };
  }

  console.log(
    `Checking existing scores for ${songIds.length} song(s), ${userPids.length} user(s), ${bandPids.length} band(s)...`,
  );
  const existing = await scores
    .find(existingFilter, {
      projection: { song_id: 1, pid: 1, role_id: 1, _id: 0 },
    })
    .toArray();

  const used = new Set(
    existing
      .filter(
        (doc) =>
          Number.isInteger(doc.song_id) &&
          Number.isInteger(doc.pid) &&
          Number.isInteger(doc.role_id),
      )
      .map((doc) =>
        tripleKey({
          songId: doc.song_id as number,
          roleId: doc.role_id as number,
          pid: doc.pid as number,
        }),
      ),
  );
  console.log(`Found ${used.size} existing unique score key(s).`);

  const countLabel =
    options.count.min === options.count.max
      ? String(options.count.min)
      : `${options.count.min}-${options.count.max}`;
  console.log(
    `Seeding ${countLabel} score(s) for each of ${songIds.length} song(s)`,
  );

  let requested = 0;
  let inserted = 0;
  const pending: SeedSongScore[] = [];

  async function flush(): Promise<void> {
    if (pending.length === 0) {
      return;
    }
    await scores.insertMany(pending);
    inserted += pending.length;
    console.log(`Inserted ${inserted} score(s) so far`);
    pending.length = 0;
  }

  for (const [index, songId] of songIds.entries()) {
    const count = pickFromRange(options.count);
    requested += count;
    const sampled = sampleTriplesForSong(
      songId,
      count,
      nonBandRoles,
      bandRoles,
      userPids,
      bandPids,
      used,
    );

    for (const triple of sampled) {
      const score = pickFromRange(scoreRange);
      pending.push({
        song_id: triple.songId,
        pid: triple.pid,
        role_id: triple.roleId,
        score,
        seed: true,
        ...deriveScoreFields(triple.roleId, score, scoreRange),
      });
    }

    if (pending.length >= INSERT_BATCH) {
      await flush();
    }

    if ((index + 1) % 50 === 0 || index + 1 === songIds.length) {
      console.log(`Prepared ${index + 1} / ${songIds.length} song(s)`);
    }
  }

  await flush();

  warnShortfall("seed:scores", requested, inserted);
  return { requested, inserted };
}

export async function wipeScores(all: boolean): Promise<number> {
  const deleted = await wipeSongScores({ all });
  logWipe("song scores", deleted, all);
  return deleted;
}

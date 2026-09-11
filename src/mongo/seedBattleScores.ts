import { getMongo } from "./client.js";
import { expandRange, pickFromRange, sampleUnique, warnShortfall } from "./range.js";
import { resolveUserPidPool } from "./pids.js";
import {
  DEFAULT_SCORE_RANGE,
  type IntRange,
  type SeedBattleScore,
  type SeedInsertResult,
} from "./types.js";
import { logWipe, wipeBattleScores } from "./wipe.js";

const INSERT_BATCH = 500;
const MATERIALIZE_LIMIT = 100_000;

type Pair = {
  battleId: number;
  pid: number;
};

function pairKey(pair: Pair): string {
  return `${pair.battleId}:${pair.pid}`;
}

type BattleListResponse = {
  battles?: { battle_id?: number }[];
};

export function requireApiBaseUrl(): string {
  const baseUrl = process.env.GOCENTRAL_API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error(
      "GOCENTRAL_API_BASE_URL is not set. Copy .env.example to .env and fill in the API base URL, or pass --battle-id.",
    );
  }
  return baseUrl.replace(/\/+$/, "");
}

export async function fetchBattleIds(baseUrl: string): Promise<number[]> {
  const url = `${baseUrl}/battles`;
  console.log(`Fetching ${url}...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `battles request failed: ${response.status} ${response.statusText}`,
    );
  }

  const payload = (await response.json()) as BattleListResponse;
  if (!payload || !Array.isArray(payload.battles)) {
    throw new Error("battles response missing a battles array");
  }

  const ids: number[] = [];
  for (const [index, battle] of payload.battles.entries()) {
    if (typeof battle?.battle_id !== "number" || !Number.isInteger(battle.battle_id)) {
      throw new Error(`battles[${index}].battle_id is not an integer`);
    }
    ids.push(battle.battle_id);
  }

  return [...new Set(ids)];
}

export async function resolveBattleIds(range?: IntRange): Promise<number[]> {
  if (range) {
    return expandRange(range);
  }

  const ids = await fetchBattleIds(requireApiBaseUrl());
  if (ids.length === 0) {
    throw new Error(
      "No battles returned from GET /battles. Pass --battle-id or create a battle first.",
    );
  }
  return ids;
}

export async function seedBattleScores(options: {
  count: number;
  battleId?: IntRange;
  pid?: IntRange;
  score?: IntRange;
}): Promise<SeedInsertResult> {
  const scoreRange = options.score ?? DEFAULT_SCORE_RANGE;
  if (scoreRange.min <= 0) {
    throw new Error("--score must be greater than 0");
  }

  const battleIds = await resolveBattleIds(options.battleId);
  const pids = await resolveUserPidPool(options.pid);
  const spaceSize = battleIds.length * pids.length;

  const db = await getMongo();
  const scores = db.collection("scores");

  const existingFilter: Record<string, unknown> = {
    battle_id: { $in: battleIds },
  };
  if (pids.length < 10_000) {
    existingFilter.pid = { $in: pids };
  }

  const existing = await scores
    .find(existingFilter, {
      projection: { battle_id: 1, pid: 1, _id: 0 },
    })
    .toArray();

  const used = new Set(
    existing
      .filter(
        (doc) => Number.isInteger(doc.battle_id) && Number.isInteger(doc.pid),
      )
      .map((doc) =>
        pairKey({
          battleId: doc.battle_id as number,
          pid: doc.pid as number,
        }),
      ),
  );

  let pairs: Pair[] = [];

  if (spaceSize <= MATERIALIZE_LIMIT) {
    const all: Pair[] = [];
    for (const battleId of battleIds) {
      for (const pid of pids) {
        const pair = { battleId, pid };
        if (!used.has(pairKey(pair))) {
          all.push(pair);
        }
      }
    }
    pairs = sampleUnique(all, options.count);
  } else {
    const maxAttempts = Math.max(options.count * 50, 100);
    let attempts = 0;
    while (pairs.length < options.count && attempts < maxAttempts) {
      attempts += 1;
      const pair = {
        battleId: battleIds[Math.floor(Math.random() * battleIds.length)]!,
        pid: pids[Math.floor(Math.random() * pids.length)]!,
      };
      const key = pairKey(pair);
      if (used.has(key)) {
        continue;
      }
      used.add(key);
      pairs.push(pair);
    }
  }

  const docs: SeedBattleScore[] = pairs.map((pair) => ({
    battle_id: pair.battleId,
    pid: pair.pid,
    score: pickFromRange(scoreRange),
    seed: true,
  }));

  for (let i = 0; i < docs.length; i += INSERT_BATCH) {
    const batch = docs.slice(i, i + INSERT_BATCH);
    await scores.insertMany(batch);
    console.log(
      `Inserted ${Math.min(i + INSERT_BATCH, docs.length)} / ${docs.length} battle scores`,
    );
  }

  warnShortfall("seed:battle-scores", options.count, docs.length);
  return { requested: options.count, inserted: docs.length };
}

export async function wipeBattleScoreRows(all: boolean): Promise<number> {
  const deleted = await wipeBattleScores({ all });
  logWipe("battle scores", deleted, all);
  return deleted;
}

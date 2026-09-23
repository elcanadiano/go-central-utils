import { getMongo } from "./client.js";
import { nextCounter } from "./counters.js";
import { expandRange, pickFromRange, warnShortfall } from "./range.js";
import {
  DEFAULT_CONSOLE_RANGE,
  type IntRange,
  type SeedInsertResult,
  type SeedUser,
} from "./types.js";
import { logWipe, wipeCollection } from "./wipe.js";

const INSERT_BATCH = 500;

function seedUsername(pid: number): string {
  return `seed_user_${String(pid).padStart(6, "0")}`;
}

function userKey(username: string, consoleType: number): string {
  return `${username.toLowerCase()}:${consoleType}`;
}

export async function seedUsers(options: {
  count: number;
  consoleType?: IntRange;
}): Promise<SeedInsertResult> {
  const db = await getMongo();
  const users = db.collection("users");
  const consoleRange = options.consoleType ?? DEFAULT_CONSOLE_RANGE;

  if (consoleRange.min < 0 || consoleRange.max > 3) {
    throw new Error("--console-type must be in 0-3");
  }

  const existing = await users
    .find(
      {},
      { projection: { username: 1, console_type: 1, _id: 0 } },
    )
    .toArray();

  const used = new Set(
    existing
      .filter(
        (doc) =>
          typeof doc.username === "string" &&
          Number.isInteger(doc.console_type),
      )
      .map((doc) => userKey(doc.username as string, doc.console_type as number)),
  );

  const consoleTypes = expandRange(consoleRange);
  const docs: SeedUser[] = [];

  while (docs.length < options.count) {
    const pid = await nextCounter("last_pid");
    const username = seedUsername(pid);
    const consoleType = pickFromRange({
      min: consoleTypes[0]!,
      max: consoleTypes[consoleTypes.length - 1]!,
    });
    const key = userKey(username, consoleType);
    if (used.has(key)) {
      continue;
    }
    used.add(key);
    docs.push({
      pid,
      username,
      console_type: consoleType,
      seed: true,
    });
  }

  for (let i = 0; i < docs.length; i += INSERT_BATCH) {
    const batch = docs.slice(i, i + INSERT_BATCH);
    await users.insertMany(batch);
    console.log(
      `Inserted ${Math.min(i + INSERT_BATCH, docs.length)} / ${docs.length} users`,
    );
  }

  warnShortfall("seed:users", options.count, docs.length);
  return { requested: options.count, inserted: docs.length };
}

export async function wipeUsers(all: boolean): Promise<number> {
  const deleted = await wipeCollection("users", { all });
  logWipe("users", deleted, all);
  return deleted;
}

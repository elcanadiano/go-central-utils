import { getMongo } from "./client.js";
import { nextCounter } from "./counters.js";
import { sampleUnique, warnShortfall } from "./range.js";
import { listBandOwnerPids, resolveUserPidPool } from "./pids.js";
import type { IntRange, SeedBand, SeedInsertResult } from "./types.js";
import { logWipe, wipeCollection } from "./wipe.js";

const INSERT_BATCH = 500;

export async function seedBands(options: {
  count: number;
  pid?: IntRange;
  name?: string;
}): Promise<SeedInsertResult> {
  const db = await getMongo();
  const bands = db.collection("bands");

  const candidates = await resolveUserPidPool(options.pid);
  const taken = new Set(await listBandOwnerPids());
  const unused = candidates.filter((pid) => !taken.has(pid));

  if (unused.length === 0) {
    throw new Error(
      "No users without a band in the PID pool. Every selected owner already has a band.",
    );
  }

  const owners = sampleUnique(unused, options.count);
  const docs: SeedBand[] = [];

  for (const ownerPid of owners) {
    const bandId = await nextCounter("last_band_id");
    docs.push({
      band_id: bandId,
      name: options.name ?? `seed_band_${bandId}`,
      owner_pid: ownerPid,
      seed: true,
    });
  }

  for (let i = 0; i < docs.length; i += INSERT_BATCH) {
    const batch = docs.slice(i, i + INSERT_BATCH);
    await bands.insertMany(batch);
    console.log(
      `Inserted ${Math.min(i + INSERT_BATCH, docs.length)} / ${docs.length} bands`,
    );
  }

  warnShortfall("seed:bands", options.count, docs.length);
  return { requested: options.count, inserted: docs.length };
}

export async function wipeBands(all: boolean): Promise<number> {
  const deleted = await wipeCollection("bands", { all });
  logWipe("bands", deleted, all);
  return deleted;
}

import { getMongo } from "./client.js";
import { formatRange } from "./range.js";
import type { IntRange } from "./types.js";

function pidFilter(range?: IntRange): Record<string, unknown> {
  if (!range) {
    return {};
  }
  return { pid: { $gte: range.min, $lte: range.max } };
}

function ownerPidFilter(range?: IntRange): Record<string, unknown> {
  if (!range) {
    return {};
  }
  return { owner_pid: { $gte: range.min, $lte: range.max } };
}

export async function listUserPids(range?: IntRange): Promise<number[]> {
  const db = await getMongo();
  const docs = await db
    .collection("users")
    .find(pidFilter(range), { projection: { pid: 1, _id: 0 } })
    .toArray();

  return docs
    .map((doc) => doc.pid)
    .filter((pid): pid is number => Number.isInteger(pid));
}

export async function listBandOwnerPids(range?: IntRange): Promise<number[]> {
  const db = await getMongo();
  const docs = await db
    .collection("bands")
    .find(ownerPidFilter(range), { projection: { owner_pid: 1, _id: 0 } })
    .toArray();

  return docs
    .map((doc) => doc.owner_pid)
    .filter((pid): pid is number => Number.isInteger(pid));
}

export async function resolveUserPidPool(range?: IntRange): Promise<number[]> {
  const pids = await listUserPids(range);
  if (pids.length === 0) {
    throw new Error(
      range
        ? `No users found with pid ${formatRange(range)}`
        : "No users found. Run `pnpm seed:users` first.",
    );
  }
  return pids;
}

export async function resolveBandOwnerPool(range?: IntRange): Promise<number[]> {
  const pids = await listBandOwnerPids(range);
  if (pids.length === 0) {
    throw new Error(
      range
        ? `No bands found with owner_pid ${formatRange(range)}`
        : "No bands found. Run `pnpm seed:bands` first for role_id 10 scores.",
    );
  }
  return pids;
}

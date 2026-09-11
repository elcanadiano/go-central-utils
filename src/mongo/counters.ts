import { getMongo } from "./client.js";

const DEFAULT_CONFIG = {
  last_pid: 500,
  last_band_id: 0,
  last_character_id: 0,
  last_setlist_id: 0,
  profanity_list: [] as string[],
  battle_limit: 5,
  last_machine_id: 1_000_000_000,
};

type CounterField = "last_pid" | "last_band_id" | "last_setlist_id";

export async function nextCounter(field: CounterField): Promise<number> {
  const db = await getMongo();
  const config = db.collection("config");

  const existing = await config.findOne({});
  if (!existing) {
    await config.insertOne({ ...DEFAULT_CONFIG });
  }

  const updated = await config.findOneAndUpdate(
    {},
    { $inc: { [field]: 1 } },
    { returnDocument: "after" },
  );

  const value = updated?.[field];
  if (typeof value !== "number") {
    throw new Error(`Could not increment config.${field}`);
  }

  return value;
}

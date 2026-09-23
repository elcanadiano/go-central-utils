export type IntRange = {
  min: number;
  max: number;
};

export type SeedUser = {
  pid: number;
  username: string;
  console_type: number;
  seed: true;
};

export type SeedBand = {
  band_id: number;
  name: string;
  owner_pid: number;
  seed: true;
};

export type SeedSongScore = {
  song_id: number;
  pid: number;
  role_id: number;
  score: number;
  notespct: number;
  stars: number;
  diff_id: number;
  boi: number;
  instrument_mask: number;
  seed: true;
};

export type SeedBattle = {
  setlist_id: number;
  pid: number;
  title: string;
  desc: string;
  type: 1002;
  owner: string;
  shared: "t";
  s_ids: number[];
  s_names: string[];
  time_end_val: number;
  time_end_units: "seconds";
  flags: number;
  instrument: number;
  created: number;
  seed: true;
};

export type SeedBattleScore = {
  battle_id: number;
  pid: number;
  score: number;
  seed: true;
};

export type SeedInsertResult = {
  requested: number;
  inserted: number;
};

export const CONSOLE_TYPES = [0, 1, 2, 3] as const;
export const BAND_ROLE_ID = 10;
export const DEFAULT_SCORE_RANGE: IntRange = { min: 50_000, max: 250_000 };
export const DEFAULT_CONSOLE_RANGE: IntRange = { min: 0, max: 3 };
export const DEFAULT_ROLE_RANGE: IntRange = { min: 0, max: 10 };

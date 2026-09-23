import "dotenv/config";
import { closeMongo, mongoDatabaseName } from "../mongo/client.js";
import {
  flagRange,
  hasWipe,
  hasWipeAll,
  parseFlags,
  requireRange,
} from "../mongo/flags.js";
import { pickFromRange } from "../mongo/range.js";
import {
  seedBattleScores,
  wipeBattleScoreRows,
} from "../mongo/seedBattleScores.js";

const USAGE = `Usage:
  pnpm seed:battle-scores --battle-id 123 --count 200
  pnpm seed:battle-scores --battle-id 123 --pid 500-699 --count 50-100 --score 80000-180000
  pnpm seed:battle-scores --count 500
  pnpm seed:battle-scores --wipe
  pnpm seed:battle-scores --wipe-all`;

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  if (hasWipe(flags) || hasWipeAll(flags)) {
    await wipeBattleScoreRows(hasWipeAll(flags));
    return;
  }

  const result = await seedBattleScores({
    count: pickFromRange(requireRange(flags, "count")),
    battleId: flagRange(flags, "battle-id"),
    pid: flagRange(flags, "pid"),
    score: flagRange(flags, "score"),
  });
  console.log(
    `Done. Inserted ${result.inserted} battle score(s) into ${mongoDatabaseName()}.`,
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error(USAGE);
  process.exitCode = 1;
} finally {
  await closeMongo();
}

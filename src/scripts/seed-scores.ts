import "dotenv/config";
import { closeMongo, mongoDatabaseName } from "../mongo/client.js";
import {
  flagRange,
  hasWipe,
  hasWipeAll,
  parseFlags,
  requireRange,
} from "../mongo/flags.js";
import { seedScores, wipeScores } from "../mongo/seedScores.js";

const USAGE = `Usage:
  pnpm seed:scores --song-id 6008 --role-id 1 --count 200
  pnpm seed:scores --song-id 6000-6100 --role-id 0-10 --count 20-80
  pnpm seed:scores --song-id 6000-6050 --role-id 0-4 --pid 500-520 --count 100 --score 80000-180000
  pnpm seed:scores --wipe
  pnpm seed:scores --wipe-all`;

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  if (hasWipe(flags) || hasWipeAll(flags)) {
    await wipeScores(hasWipeAll(flags));
    return;
  }

  const result = await seedScores({
    count: requireRange(flags, "count"),
    songId: flagRange(flags, "song-id"),
    roleId: flagRange(flags, "role-id"),
    pid: flagRange(flags, "pid"),
    score: flagRange(flags, "score"),
  });
  console.log(
    `Done. Inserted ${result.inserted} song score(s) into ${mongoDatabaseName()}.`,
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

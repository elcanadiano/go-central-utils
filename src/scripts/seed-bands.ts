import "dotenv/config";
import { closeMongo, mongoDatabaseName } from "../mongo/client.js";
import {
  flagRange,
  flagString,
  hasWipe,
  hasWipeAll,
  parseFlags,
} from "../mongo/flags.js";
import { pickFromRange, rangeSize } from "../mongo/range.js";
import { seedBands, wipeBands } from "../mongo/seedBands.js";

const USAGE = `Usage:
  pnpm seed:bands --count 50
  pnpm seed:bands --count 10 --pid 500-509
  pnpm seed:bands --pid 500 --name "T. Wrecks"
  pnpm seed:bands --wipe
  pnpm seed:bands --wipe-all`;

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  if (hasWipe(flags) || hasWipeAll(flags)) {
    await wipeBands(hasWipeAll(flags));
    return;
  }

  const countRange = flagRange(flags, "count");
  const pidRange = flagRange(flags, "pid");
  const count = countRange
    ? pickFromRange(countRange)
    : pidRange && rangeSize(pidRange) === 1
      ? 1
      : undefined;

  if (count === undefined) {
    throw new Error("--count is required (use N or N-M), unless --pid is a single account");
  }

  const result = await seedBands({
    count,
    pid: pidRange,
    name: flagString(flags, "name"),
  });
  console.log(
    `Done. Inserted ${result.inserted} band(s) into ${mongoDatabaseName()}.`,
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

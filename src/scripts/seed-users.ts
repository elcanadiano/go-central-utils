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
import { seedUsers, wipeUsers } from "../mongo/seedUsers.js";

const USAGE = `Usage:
  pnpm seed:users --count 500
  pnpm seed:users --count 50-100 --console-type 1
  pnpm seed:users --wipe
  pnpm seed:users --wipe-all`;

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  if (hasWipe(flags) || hasWipeAll(flags)) {
    await wipeUsers(hasWipeAll(flags));
    return;
  }

  const countRange = requireRange(flags, "count");
  const result = await seedUsers({
    count: pickFromRange(countRange),
    consoleType: flagRange(flags, "console-type"),
  });
  console.log(
    `Done. Inserted ${result.inserted} user(s) into ${mongoDatabaseName()}.`,
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

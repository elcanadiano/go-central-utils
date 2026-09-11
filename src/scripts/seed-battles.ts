import "dotenv/config";
import { closeMongo, mongoDatabaseName } from "../mongo/client.js";
import {
  flagRange,
  flagString,
  hasWipe,
  hasWipeAll,
  parseFlags,
  requireRange,
} from "../mongo/flags.js";
import { pickFromRange } from "../mongo/range.js";
import { seedBattles, wipeBattles } from "../mongo/seedBattles.js";

const USAGE = `Usage:
  pnpm seed:battles --count 3
  pnpm seed:battles --count 5 --song-id 6000-6100 --songs-per-battle 3 --instrument 1
  pnpm seed:battles --count 1 --title "Weekend Challenge" --duration-seconds 86400
  pnpm seed:battles --wipe
  pnpm seed:battles --wipe-all`;

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  if (hasWipe(flags) || hasWipeAll(flags)) {
    await wipeBattles(hasWipeAll(flags));
    return;
  }

  const result = await seedBattles({
    count: pickFromRange(requireRange(flags, "count")),
    songId: flagRange(flags, "song-id"),
    songsPerBattle: flagRange(flags, "songs-per-battle"),
    instrument: flagRange(flags, "instrument"),
    durationSeconds: flagRange(flags, "duration-seconds"),
    title: flagString(flags, "title"),
    desc: flagString(flags, "desc"),
  });
  console.log(
    `Done. Inserted ${result.inserted} battle(s) into ${mongoDatabaseName()}.`,
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

import { parseIntRange } from "./range.js";
import type { IntRange } from "./types.js";

export type ParsedFlags = {
  values: Map<string, string>;
  bools: Set<string>;
};

export function parseFlags(argv: string[]): ParsedFlags {
  const values = new Map<string, string>();
  const bools = new Set<string>();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const eq = arg.indexOf("=");
    if (eq !== -1) {
      values.set(arg.slice(2, eq), arg.slice(eq + 1));
      continue;
    }

    const name = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("-")) {
      values.set(name, next);
      i += 1;
    } else {
      bools.add(name);
    }
  }

  return { values, bools };
}

export function flagRange(
  flags: ParsedFlags,
  name: string,
): IntRange | undefined {
  const value = flags.values.get(name);
  return value === undefined ? undefined : parseIntRange(value, `--${name}`);
}

export function requireRange(flags: ParsedFlags, name: string): IntRange {
  const range = flagRange(flags, name);
  if (!range) {
    throw new Error(`--${name} is required (use N or N-M)`);
  }
  return range;
}

export function flagString(
  flags: ParsedFlags,
  name: string,
): string | undefined {
  return flags.values.get(name);
}

export function hasWipe(flags: ParsedFlags): boolean {
  return flags.bools.has("wipe") || flags.values.has("wipe");
}

export function hasWipeAll(flags: ParsedFlags): boolean {
  return flags.bools.has("wipe-all") || flags.values.has("wipe-all");
}

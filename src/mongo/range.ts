import type { IntRange } from "./types.js";

export function parseIntRange(value: string, label: string): IntRange {
  const match = /^(-?\d+)(?:-(-?\d+))?$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid ${label}: ${value} (use N or N-M)`);
  }

  const min = Number(match[1]);
  const max = match[2] === undefined ? min : Number(match[2]);
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  if (max < min) {
    throw new Error(`Invalid ${label}: ${value} (max is less than min)`);
  }

  return { min, max };
}

export function formatRange(range: IntRange): string {
  return range.min === range.max ? String(range.min) : `${range.min}-${range.max}`;
}

export function pickFromRange(range: IntRange): number {
  return range.min + Math.floor(Math.random() * (range.max - range.min + 1));
}

export function rangeSize(range: IntRange): number {
  return range.max - range.min + 1;
}

export function expandRange(range: IntRange): number[] {
  const values: number[] = [];
  for (let value = range.min; value <= range.max; value += 1) {
    values.push(value);
  }
  return values;
}

export function sampleUnique<T>(items: readonly T[], count: number): T[] {
  if (count <= 0 || items.length === 0) {
    return [];
  }

  const take = Math.min(count, items.length);
  const copy = items.slice();
  for (let i = 0; i < take; i += 1) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    const current = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = current;
  }
  return copy.slice(0, take);
}

export function warnShortfall(
  label: string,
  requested: number,
  inserted: number,
): void {
  if (inserted < requested) {
    console.warn(
      `${label}: requested ${requested}, inserted ${inserted} (not enough unique unused keys)`,
    );
  }
}

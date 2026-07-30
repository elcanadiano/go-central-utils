export type DtaValue = string | number | DtaValue[];

/**
 * Parse Harmonix-style DTA (S-expression) text into nested arrays.
 * Supports double-quoted strings, single-quoted tokens, symbols, and numbers.
 */
export function parseDta(input: string): DtaValue[] {
  const tokens = tokenize(input);
  const values: DtaValue[] = [];
  let i = 0;

  while (i < tokens.length) {
    const [value, next] = parseValue(tokens, i);
    values.push(value);
    i = next;
  }

  return values;
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i]!;

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (ch === ";") {
      while (i < input.length && input[i] !== "\n") {
        i += 1;
      }
      continue;
    }

    if (ch === "(" || ch === ")") {
      tokens.push(ch);
      i += 1;
      continue;
    }

    if (ch === '"') {
      let value = "";
      i += 1;
      while (i < input.length) {
        const c = input[i]!;
        if (c === "\\") {
          const next = input[i + 1];
          if (next == null) {
            throw new Error("Unterminated escape in DTA string");
          }
          // Harmonix DTA uses \q for a literal double-quote character.
          value += next === "q" ? '"' : next;
          i += 2;
          continue;
        }
        if (c === '"') {
          i += 1;
          break;
        }
        value += c;
        i += 1;
      }
      tokens.push(JSON.stringify(value));
      continue;
    }

    if (ch === "'") {
      let value = "";
      i += 1;
      while (i < input.length && input[i] !== "'") {
        value += input[i];
        i += 1;
      }
      if (input[i] !== "'") {
        throw new Error("Unterminated single-quoted DTA token");
      }
      i += 1;
      tokens.push(JSON.stringify(value));
      continue;
    }

    let atom = "";
    while (i < input.length) {
      const c = input[i]!;
      if (/\s/.test(c) || c === "(" || c === ")" || c === ";" || c === '"' || c === "'") {
        break;
      }
      atom += c;
      i += 1;
    }
    tokens.push(atom);
  }

  return tokens;
}

function parseValue(tokens: string[], start: number): [DtaValue, number] {
  const token = tokens[start];
  if (token == null) {
    throw new Error("Unexpected end of DTA input");
  }

  if (token === "(") {
    const list: DtaValue[] = [];
    let i = start + 1;
    while (i < tokens.length && tokens[i] !== ")") {
      const [value, next] = parseValue(tokens, i);
      list.push(value);
      i = next;
    }
    if (tokens[i] !== ")") {
      throw new Error("Unterminated DTA list");
    }
    return [list, i + 1];
  }

  if (token === ")") {
    throw new Error("Unexpected ) in DTA input");
  }

  if (token.startsWith('"') && token.endsWith('"')) {
    return [JSON.parse(token) as string, start + 1];
  }

  if (/^[+-]?\d+(\.\d+)?$/.test(token)) {
    return [Number(token), start + 1];
  }

  return [token, start + 1];
}

export type DtaSongFields = {
  songId: string;
  songIdNumber: number;
  name: string | null;
  artist: string | null;
  album: string | null;
  genre: string | null;
};

function isList(value: DtaValue): value is DtaValue[] {
  return Array.isArray(value);
}

function asString(value: DtaValue | undefined): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return null;
}

function fieldValue(entry: DtaValue[], key: string): DtaValue | undefined {
  for (const item of entry) {
    if (!isList(item) || item.length === 0) {
      continue;
    }
    if (item[0] === key) {
      return item.length === 2 ? item[1] : item.slice(1);
    }
  }
  return undefined;
}

/**
 * Extract song catalog fields from top-level DTA entries of the form:
 * (song_id_slug (name "...") (artist "...") (song_id N) ...)
 */
export function extractDtaSongs(values: DtaValue[]): DtaSongFields[] {
  const songs: DtaSongFields[] = [];

  for (const value of values) {
    if (!isList(value) || value.length === 0) {
      continue;
    }

    const songId = asString(value[0]);
    if (songId == null) {
      continue;
    }

    const songIdRaw = fieldValue(value, "song_id");
    if (typeof songIdRaw !== "number" || !Number.isFinite(songIdRaw)) {
      continue;
    }

    songs.push({
      songId,
      songIdNumber: songIdRaw,
      name: asString(fieldValue(value, "name")),
      artist: asString(fieldValue(value, "artist")),
      album: asString(fieldValue(value, "album_name")),
      genre: asString(fieldValue(value, "genre")),
    });
  }

  return songs;
}

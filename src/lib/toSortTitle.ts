const LEAD_ARTICLE = /^(the|an|a)\s+/i;

/**
 * Moves a leading English article (The / A / An) to the end for sort order.
 * e.g. "The Land Before Time" → "Land Before Time, The"
 */
export function toSortTitle(title: string): string {
  const trimmed = title.trim();
  const match = LEAD_ARTICLE.exec(trimmed);

  if (!match) {
    return trimmed;
  }

  const article = match[1]!;
  const rest = trimmed.slice(match[0].length).trim();

  if (!rest) {
    return trimmed;
  }

  const normalized =
    article.charAt(0).toUpperCase() + article.slice(1).toLowerCase();

  return `${rest}, ${normalized}`;
}

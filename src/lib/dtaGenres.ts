/** Maps Harmonix DTA genre symbols to rb4app-style display labels. */
export const DTA_GENRE_LABELS: Record<string, string> = {
  acapella: "A Cappella",
  alternative: "Alternative",
  blues: "Blues",
  classical: "Classical",
  classicrock: "Classic Rock",
  country: "Country",
  disco: "Disco",
  emo: "Emo",
  folkrock: "Folk Rock",
  funk: "R&B/Soul/Funk",
  fusion: "Fusion",
  glam: "Glam",
  grunge: "Grunge",
  hardrock: "Hard Rock",
  hiphoprap: "Hip-Hop/Rap",
  indierock: "Indie Rock",
  industrial: "Industrial",
  inspirational: "Inspirational",
  jazz: "Jazz",
  jrock: "J-Rock",
  latin: "Latin",
  metal: "Metal",
  new_wave: "New Wave",
  novelty: "Novelty",
  numetal: "Nu-Metal",
  other: "Other",
  pop: "Pop/Dance/Electronic",
  popdanceelectronic: "Pop/Dance/Electronic",
  poprock: "Pop-Rock",
  posthardcore: "Post-Hardcore",
  prog: "Prog",
  psychadelic: "Psychedelic",
  punk: "Punk",
  rbsoulfunk: "R&B/Soul/Funk",
  reggaeska: "Reggae/Ska",
  rhythmandblues: "R&B/Soul/Funk",
  rock: "Rock",
  rockabilly: "Rockabilly",
  southernrock: "Southern Rock",
  urban: "Urban",
  world: "World",
};

/**
 * Returns the display label for a DTA genre symbol.
 * Unknown symbols are returned unchanged so imports can still proceed.
 */
export function mapDtaGenre(symbol: string | null | undefined): string | null {
  if (symbol == null) {
    return null;
  }

  const trimmed = symbol.trim();
  if (!trimmed) {
    return null;
  }

  return DTA_GENRE_LABELS[trimmed] ?? trimmed;
}

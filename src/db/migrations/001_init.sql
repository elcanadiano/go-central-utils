CREATE TABLE songs (
  song_id_number  INTEGER PRIMARY KEY,
  song_id         TEXT UNIQUE,
  album           TEXT,
  album2          TEXT,
  artist          TEXT,
  artist2         TEXT,
  genre           TEXT,
  name            TEXT,
  name2           TEXT
);

CREATE INDEX songs_name2_idx ON songs (name2);

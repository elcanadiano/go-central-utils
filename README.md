# GoCentralUtils

This repository is a companion repository for
[GoCentralScores](https://github.com/elcanadiano/go-central-scores). It aims to set up any
necessary changes to the database for GoCentralScores or aims to house other necessary scripts.

GoCentralScores and GoCentralUtils uses a PostgreSQL database with a `songs` table in order to have
a record of song information, as [GoCentral](https://github.com/ihatecompvir/GoCentral) and
traditionally, Rock Band servers do not store song information.

## Setup

```bash
pnpm install
cp .env.example .env
```

Edit `.env` with your database credentials and (for API imports) the GoCentral API base URL.

### Database config

Use either discrete `PG*` vars **or** a single `DATABASE_URL`. If `DATABASE_URL` is set, it takes
precedence.

**Local Postgres:**

```env
PGHOST=localhost
PGPORT=5432
PGUSER=user
PGPASSWORD=password
PGDATABASE=gocentral
```

**Neon / hosted Postgres:**

```env
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

You can leave the `PG*` block commented out when using a URL.

Also set the API base (no trailing slash) if you use the API importer:

```env
GOCENTRAL_API_BASE_URL=http://localhost:9103
```



## Database

Apply pending SQL migrations from `src/db/migrations/`:

```bash
pnpm db:migrate
```

List applied vs pending migrations:

```bash
pnpm db:status
```

The main table is `songs`:


| Column               | Notes                  |
| -------------------- | ---------------------- |
| `song_id_number`     | Primary key (`BIGINT`) |
| `song_id`            | Optional slug (not unique) |
| `album` / `album2`   | Display + sort title   |
| `artist` / `artist2` | Display + sort title   |
| `genre`              | Genre string           |
| `name` / `name2`     | Display + sort title   |


There is an index on `name2`. The `name2`, `artist2`, and `album2` fields append articles to the end
(where applicable), whereas `name`, `artist`, and `album` do not. For example, consider the song,
"The Middle" by "Jimmy Eat World" from the "Bleed American" album. In this example, `artist2` and
`album2` are identical, but while the `name` is "The Middle", the `name2` is "Middle, The."

## Import Scripts

These are the import scripts which actually adds songs into the PostgreSQL database. By default,
imports **upsert** on `song_id_number` (update existing rows). Pass `-dn` / `--do-nothing` to insert
only when the row does not already exist.

### `import:songs-json`

```bash
pnpm import:songs-json path/to/songs.json
pnpm import:songs-json path/to/songs.json --do-nothing
```

This imports songs from a specific JSON file, which is the same format as the JSON used in
[rb4.app](https://rb4.app).

### `import:songs-dta`

```bash
pnpm import:songs-dta path/to/song_map.dta
pnpm import:songs-dta path/to/song_map.dta -dn
```

Parses a Rock Band-style DTA song map, maps genres, and derives `name2` / `artist2` / `album2` sort
titles. Upserts only on `song_id_number`; the same `song_id` slug may exist on multiple rows.

Those with large song counts can build a master `.dta` file using
[Arson](https://github.com/hmxmilohax/arson) for use of importing using this script.

### `import:songs-api`

```bash
pnpm import:songs-api --do-nothing
pnpm import:songs-api --yes
```

Fetches song IDs from `GET {GOCENTRAL_API_BASE_URL}/song_list` and inserts rows with only
`song_id_number` set (other columns `null`). Prefer `--do-nothing`; upsert mode can clear metadata
on existing rows and prompts for confirmation unless you pass `-y` / `--yes`.

GoCentralScores supports searching on a song ID. As a result, this is an option just to add songs
without metadata.

## Creating a DTA file for import

The [dta_format.md](./dta_format.md) file provides a guide which allows you to grab all the
`song.dta` files from your `USRDIR` directory in RPCS3 and automates some of the `arson-fmt` setup
in order to make the file transfer easier.

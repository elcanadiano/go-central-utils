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

Edit `.env` with your database credentials, (for API imports and battle-score seeding) the
GoCentral API base URL, and (for Mongo seed scripts) `MONGOCONNECTIONSTRING`.

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

MONGOCONNECTIONSTRING=mongodb://localhost:27017
# MONGODATABASE=gocentral
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

## Mongo seed scripts

These write fake documents into GoCentral's MongoDB so REST endpoints can be exercised locally.
They are not for production. Documents are tagged `seed: true`.

Set `MONGOCONNECTIONSTRING` (same name as GoCentral). `MONGODATABASE` defaults to `gocentral`.
GoCentral now also reads `MONGODATABASE` (default `gocentral`) so a test server can use a copy.

Uniqueness is enforced in the seeder, not with Mongo indexes:

- users: `(username, console_type)` and `pid`
- bands: one band per `owner_pid` (not every user has a band)
- song scores: `(song_id, pid, role_id)`
- battles: `setlist_id` (from `config.last_setlist_id`)
- battle scores: `(battle_id, pid)`

`--count`, `--song-id`, `--role-id`, `--pid`, `--score`, and `--battle-id` accept `N` or `N-M`.
`--wipe` deletes `{ seed: true }` docs for that script. `--wipe-all` clears that collection (or
that score subset).

### `seed:users`

```bash
pnpm seed:users --count 500
pnpm seed:users --count 50-100 --console-type 1
pnpm seed:users --wipe
```

`--console-type` is `0` (360), `1` (PS3), `2` (Wii), `3` (RPCS3). Omit it to pick `0-3` at random.
PIDs come from `config.last_pid`. Usernames are `seed_user_<pid>`.

### `seed:bands`

```bash
pnpm seed:bands --count 50
pnpm seed:bands --count 10 --pid 500-509
pnpm seed:bands --pid 500 --name "T. Wrecks"
pnpm seed:bands --wipe
```

Owners are existing users who do not already have a band. `--pid` pins or restricts owners.

### `seed:scores`

```bash
pnpm seed:scores --song-id 6008 --role-id 1 --count 200
pnpm seed:scores --song-id 6000-6100 --role-id 0-10 --count 20-80
pnpm seed:scores --song-id 6000-6050 --role-id 0-4 --pid 500-520 --count 100 --score 80000-180000
pnpm seed:scores --wipe
```

`--count` is **per song ID**. `--song-id 6008 --count 200` inserts 200 rows for that song;
`--song-id 6000-6100 --count 20-80` inserts 20–80 rows for **each** ID in the range (each song
draws its own count). Omit `--pid` to pick a random existing user (or a band owner when
`role_id` is 10). Omit `--song-id` to use IDs from the Postgres `songs` table if it is configured
(count still applies to each of those IDs). Default `--score` is `50000-250000`. Default
`--role-id` is `0-10`.

### `seed:battles`

```bash
pnpm seed:battles --count 3
pnpm seed:battles --count 5 --song-id 6000-6100 --songs-per-battle 3 --instrument 1
pnpm seed:battles --count 1 --title "Weekend Challenge" --duration-seconds 86400
pnpm seed:battles --wipe
```

Creates Harmonix battles (`setlists` with `type: 1002`) so `GET /battles` and
`seed:battle-scores` have IDs to use. IDs come from `config.last_setlist_id`. Owner is
`Harmonix`, `pid` is `0`. Default duration is 7 days so they are not expired.
`--song-id` is the pool to draw from (or the Postgres `songs` table if omitted).
`--wipe-all` removes Harmonix battles only, not player setlists.

### `seed:battle-scores`

```bash
pnpm seed:battle-scores --battle-id 123 --count 200
pnpm seed:battle-scores --battle-id 123 --pid 500-699 --count 50-100 --score 80000-180000
pnpm seed:battle-scores --count 500
pnpm seed:battle-scores --wipe
```

`--battle-id` is the same identifier as `GET /leaderboards/battle`. If omitted, IDs come from
`GET {GOCENTRAL_API_BASE_URL}/battles` (including battles created by `seed:battles`).

## Creating a DTA file for import

The [dta_format.md](./dta_format.md) file provides a guide which allows you to grab all the
`song.dta` files from your `USRDIR` directory in RPCS3 and automates some of the `arson-fmt` setup
in order to make the file transfer easier.

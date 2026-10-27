# Local Postgres without Docker

Dev and test work uses one Homebrew Postgres server (`postgresql@18`) on `localhost:5432`. Every worktree, audit owner, and project gets its own database on that server. Docker is only for production deploys (`app/docker-compose.yml`).

## One server, many databases

Many Postgres servers on this Mac default to port 5432: older Homebrew versions (`postgresql@14`, `postgresql@15`), the old `vn-db2` and `vn-dev-pg` containers, and bible-daily's container. When two of them bind 5432, `localhost` can reach either one. To stop them from fighting:

- Run only `postgresql@18` as a Homebrew service. Leave other versions stopped (`brew services list`).
- Link 18 so plain `psql`, `pg_dump`, and `createdb` match the server: `brew unlink postgresql@15; brew link --force postgresql@18`. Older tools cannot read dumps from newer servers.
- Do not start Postgres containers for dev. Make a new database on the shared server instead.
- `audit:db` checks that the server on the port is Homebrew's. If another server answers, it names it and stops.

Idle, the server uses about 30 MB. With a dev server and its connection pool attached, it uses about 200 MB. The Docker Desktop VM used 7 GB.

## Start, migrate, reset

From any worktree's `app/` directory:

```sh
corepack pnpm audit:db -- --owner <slug>
```

This command:

1. Starts `postgresql@18` with `brew services` if nothing listens on the env file's port (it installs the formula first if it is missing).
2. Creates the env file's role (`postgres`/`postgres`) if it is missing.
3. Creates `visual_notes_audit_<slug>` and applies every migration.
4. Prints the commands that start the app (`pnpm dev` through `audit:harness`) and run Playwright against it.

Rerun it after you pull new migrations. Reset the database with `--drop`, then run the command again:

```sh
corepack pnpm audit:db -- --owner <slug> --drop
corepack pnpm audit:db -- --owner <slug>
```

Database-backed vitest files (`*.db.test.ts`) run when `TEST_DATABASE_URL` names an audit database:

```sh
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/visual_notes_audit_<slug> corepack pnpm test
```

Server commands, if you need them:

```sh
brew services start postgresql@18
brew services stop postgresql@18
psql -h localhost -U postgres -l
```

## The main checkout's database

The main checkout's `app/.env` names a database `visual-notes`. It holds a copy of the old `vn-db2` container's `visual_notes` database (22 synthetic notes, no users; real notes live in production). To start it again empty:

```sh
cd app
dropdb -h localhost -U postgres --force visual-notes
createdb -h localhost -U postgres visual-notes
pnpm prisma migrate deploy
```

To copy a database out of an old container, start Docker Desktop, then:

```sh
docker start vn-db2
docker exec vn-db2 pg_dump -U postgres -Fc visual_notes > tmp/vn-db2.dump
docker stop vn-db2
createdb -h localhost -U postgres visual-notes
pg_restore -h localhost -U postgres -d visual-notes --no-owner tmp/vn-db2.dump
```

The Postgres containers now have `--restart=no`, so they do not take port 5432 when Docker starts. Their volumes are intact. bible-daily's container also holds the `bible` database and 26 old `visual_notes_audit_*` databases from earlier agents.

## Options we did not choose

- **PGlite** runs Postgres in WebAssembly in the Node process. Prisma reaches it only through a driver adapter, so the app's Prisma client and the `prisma migrate` CLI would both need changes. The app would also run on a different engine in dev than in production.
- **embedded-postgres** (npm) downloads Postgres binaries and runs one server for each process. Many worktrees would mean many servers, more memory, and more ports.
- **Postgres.app** works, but it is a GUI app that `audit:db` cannot install or start from a script. Homebrew was already installed.
- **Docker** costs 7 GB or more for its VM, which is the problem this change removes.

No extension blocks a plain install. The schema needs only `pg_trgm`, which ships with Homebrew Postgres. Embeddings are `Float[]` columns, not `pgvector`.

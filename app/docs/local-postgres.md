# Local Postgres without Docker

Dev and test work uses one Homebrew Postgres server (`postgresql@15`) on `localhost:5432`. Every worktree, audit owner, and project gets its own database on that server. Docker is only for production deploys (`app/docker-compose.yml`).

## One server, many databases

Many Postgres servers on this Mac default to port 5432: Homebrew `postgresql@14` and `postgresql@15`, the old `vn-db2` and `vn-dev-pg` containers, and bible-daily's container. When two of them bind 5432, `localhost` can reach either one. To stop them from fighting:

- Run only `postgresql@15` as a Homebrew service. Leave other versions stopped (`brew services list`).
- Do not start Postgres containers for dev. Make a new database on the shared server instead.
- `audit:db` checks that the server on the port is Homebrew's. If another server answers, it names it and stops.

Idle, the server uses about 30 MB. With a dev server and its connection pool attached, it uses about 200 MB. The Docker Desktop VM used 7 GB.

## Start, migrate, reset

From any worktree's `app/` directory:

```sh
corepack pnpm audit:db -- --owner <slug>
```

This command:

1. Starts `postgresql@15` with `brew services` if nothing listens on the env file's port (it installs the formula first if it is missing).
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
brew services start postgresql@15
brew services stop postgresql@15
psql -h localhost -U postgres -l
```

## The main checkout's database

The main checkout's `app/.env` names a database `visual-notes`. Before this change it lived in the `vn-db2` container. To give `pnpm dev` in the main checkout an empty database:

```sh
cd app
createdb -h localhost -U postgres visual-notes
pnpm prisma migrate deploy
```

To copy the data from `vn-db2` instead, start Docker Desktop one last time, then:

```sh
docker exec vn-db2 pg_dump -U postgres -Fc visual-notes > tmp/vn-db2.dump
docker update --restart=no vn-db2 bible-daily-db-1
docker stop vn-db2 bible-daily-db-1
createdb -h localhost -U postgres visual-notes
pg_restore -h localhost -U postgres -d visual-notes --no-owner tmp/vn-db2.dump
```

`docker update --restart=no` keeps the containers from taking port 5432 again the next time Docker starts. The Docker volume stays intact until you remove it.

## Options we did not choose

- **PGlite** runs Postgres in WebAssembly in the Node process. Prisma reaches it only through a driver adapter, so the app's Prisma client and the `prisma migrate` CLI would both need changes. The app would also run on a different engine in dev than in production.
- **embedded-postgres** (npm) downloads Postgres binaries and runs one server for each process. Many worktrees would mean many servers, more memory, and more ports.
- **Postgres.app** works, but it is a GUI app that `audit:db` cannot install or start from a script. Homebrew was already installed.
- **Docker** costs 7 GB or more for its VM, which is the problem this change removes.

No extension blocks a plain install. The schema needs only `pg_trgm`, which ships with Homebrew Postgres. Embeddings are `Float[]` columns, not `pgvector`.

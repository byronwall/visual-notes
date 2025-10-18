# implement server

we currently have a client only app and a solid start helper in `bible-solid-start`.

Immediately we need to:

- Migrate the client only app to the server on the index route -- remove any of the starter kit stuff
- Get the bible passages to flow through the server - persist in DB and cache
- Add user registration and login via password only auth
- Update database so it can store reading plans
- Update database to store reading history and progress for users
- Once all that's done, migrate the bible-solid-start folder to the root of the repo and remove old vestigial client code

Work completed:

TODO: update as we go.

## Plan from Cursor

### Client Migration to Solid Start

- Replace starter UI on `bible-solid-start/src/routes/index.tsx` with the existing app flow (`PlanImport`/`PlanView`), guarded by password auth (login/register forms when unauthenticated).
- Implement password-only auth using Auth.js Credentials provider; remove Discord. Add a simple register endpoint that hashes passwords with bcrypt and stores them in Prisma.
- Normalize DB schema to support global and user-owned plans, per-day passages, user reading progress, and an ESV HTML cache with a 7-day TTL.
- Expose pRPC endpoints for passages (HTML with cache), plans (list base/mine, create from CSV, get by id), and progress (get/mark/reset). Require auth where appropriate.
- Migrate client components to call server endpoints; store plan and progress in DB.

### Key File Changes

- `bible-solid-start/prisma/schema.prisma`: add models `Plan`, `PlanDay`, `Passage`, `DayPassage`, `ReadingProgress`, `PassageCache`; extend `User` with `passwordHash`.
- `bible-solid-start/src/server/auth.ts`: remove Discord, add Credentials provider; keep PrismaAdapter for sessions.
- `bible-solid-start/src/routes/api/auth/register.ts`: POST register endpoint (hash password, create user).
- `bible-solid-start/src/server/env/schema.ts`: add `ESV_API_KEY`.
- `bible-solid-start/src/server/passage/passage.queries.ts`: `getHtml({ query })` -> DB cache or fetch ESV; update cache with 7-day expiry.
- `bible-solid-start/src/server/plan/plan.queries.ts`: list base/mine; createFromCsv (server CSV parse+normalize); get(planId).
- `bible-solid-start/src/server/progress/progress.queries.ts`: get for current plan; mark; reset.
- `bible-solid-start/src/routes/index.tsx`: render app shell; auth guard; show login/register or plan UI.
- `bible-solid-start/src/components/*`: port `PlanImport`, `PlanView`, `ReaderModal`, `PassageChip`, `PlanTable`, `DayCard`, `sampleCsv.tsx`; adjust to use pRPC only.
- Remove hard-coded starter links/content; keep router/auth bootstrapping intact.

### Notes / Constraints

- No JSON columns; fully normalized relations.
- Cache bible passage HTML on the server with TTL; progress/plans persist in DB.
- 7-day TTL for ESV cache; SQLite for now; Prisma can later switch to Postgres.
- No legacy client localStorage migration.

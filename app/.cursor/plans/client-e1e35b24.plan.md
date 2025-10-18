<!-- e1e35b24-1638-452b-be7d-1e82a776401a d235ab33-bcd4-468b-b272-e5856d5c76cb -->
# Client Migration to Solid Start

- Replace starter UI on `bible-solid-start/src/routes/index.tsx` with the existing app flow (`PlanImport`/`PlanView`), guarded by password auth (login/register forms when unauthenticated).
- Implement password-only auth using Auth.js Credentials provider; remove Discord. Add a simple register endpoint that hashes passwords with bcrypt and stores them in Prisma.
- Normalize DB schema to support global and user-owned plans, per-day passages, user reading progress, and an ESV HTML cache with a 7-day TTL.
- Expose pRPC endpoints for passages (HTML with cache), plans (list base/mine, create from CSV, get by id), and progress (get/mark/reset). Require auth where appropriate.
- Migrate client components to call server endpoints; keep localStorage caching only for passage HTML with TTL. Store plan and progress in DB; no client local import needed.

### Key File Changes

- `bible-solid-start/prisma/schema.prisma`: add models `Plan`, `PlanDay`, `Passage`, `DayPassage`, `ReadingProgress`, `PassageCache`; extend `User` with `passwordHash`.
- `bible-solid-start/src/server/auth.ts`: remove Discord, add Credentials provider; keep PrismaAdapter for sessions.
- `bible-solid-start/src/routes/api/auth/register.ts`: POST register endpoint (hash password, create user).
- `bible-solid-start/src/server/env/schema.ts`: add `ESV_API_KEY`.
- `bible-solid-start/src/server/passage/passage.queries.ts`: `getHtml({ query })` -> DB cache or fetch ESV; update cache with 7-day expiry.
- `bible-solid-start/src/server/plan/plan.queries.ts`: list base/mine; createFromCsv (server CSV parse+normalize); get(planId).
- `bible-solid-start/src/server/progress/progress.queries.ts`: get for current plan; mark; reset.
- `bible-solid-start/src/routes/index.tsx`: render app shell; auth guard; show login/register or plan UI.
- `bible-solid-start/src/components/*`: port `PlanImport`, `PlanView`, `ReaderModal`, `PassageChip`, `PlanTable`, `DayCard`, `sampleCsv.tsx`; adjust to use pRPC and localStorage cache for passage HTML only.
- Remove hard-coded starter links/content; keep router/auth bootstrapping intact.

### Notes / Constraints

- No JSON columns; fully normalized relations.
- Cache only bible passage HTML in localStorage with TTL; progress/plans persist in DB.
- 7-day TTL for ESV cache; SQLite for now; Prisma can later switch to Postgres.
- No legacy client localStorage migration.

### To-dos

- [ ] Extend Prisma schema with plan/progress/cache models and passwordHash
- [ ] Generate and apply Prisma migration to SQLite
- [ ] Add ESV_API_KEY to server env schema and .env
- [ ] Replace Discord with Credentials provider in auth.ts
- [ ] Create POST /api/auth/register to hash and save users
- [ ] Add passage.getHtml with DB caching and 7-day TTL
- [ ] Add plan list/create/get endpoints (base and user)
- [ ] Add progress get/mark/reset endpoints
- [ ] Port client components to Solid Start and wire to pRPC
- [ ] LocalStorage cache for passage HTML with TTL
- [ ] Replace starter UI with app shell + auth guard
- [ ] Remove starter links and unused code
- [ ] Run dev and test auth, plans, reading, cache, progress
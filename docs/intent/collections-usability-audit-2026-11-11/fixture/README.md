# Actual-component synthetic fixture

This is audit scaffolding, not application implementation. It imports the current checkout's real CollectionPage, store, table, toolbar, views and controls. Server actions/membership/summary reads are mocked. The full RowPeekPanel is replaced by an explicitly labelled **actual PropertyList inside actual SidePanel**; the note editor and its save guard are not mounted. There is no authenticated session, real database, production app shell/sidebar, SSR or durable save. Source behavior may change as the checkout changes; compare against the pinned baseline in the parent evidence register.

## Run locally

Use Node 24+ and the app's pinned pnpm 9.15.9. From repo root:

```sh
cd app
corepack pnpm install --frozen-lockfile
corepack pnpm panda
cd ../docs/intent/collections-usability-audit-2026-11-11/fixture
ln -s ../../../../app/node_modules node_modules
corepack pnpm exec vite --config vite.config.ts
```

If the symlink already exists, do not recreate it. Vite serves loopback port 3348; choose an available port explicitly if occupied. Never point this fixture at production services or add credentials. `COLLECTIONS_APP_ROOT` can select another local checkout's app directory; document its SHA. The fixture depends on app node_modules, not a new dependency tree.

Open `http://127.0.0.1:3348/viewport.html?w=390&h=844` or `?w=1280&h=800`, `?w=1366&h=768`, `?w=1440&h=900`. The iframe is the exact CSS viewport; its provenance banner is outside that viewport, so screenshots are taller than h. The default dataset has 110 rows and 15 views. Query parameters `views=1`, `rows=300`, `type=board`, `type=gallery`, `type=calendar`, and `wide=1` allow targeted investigation, but only the recorded scenarios were audited. The fixture currently defines 15 names, so views=30 does not produce 30 views; extend the synthetic names before that stress test.

Inspect the initial table, scroll it, click title versus Open, select all, and open long text in the fixture panel. To reproduce CU-05, focus the final row property and press Tab repeatedly; focus the first title and press Shift+Tab. Record focus row/column after each key. Ratings in this fixture are select values, not numeric stars. Mock mutations cannot prove server persistence, failure recovery or correct creation/deletion semantics.

The original capture used equivalent absolute module paths and a host binding supported by its browser runner. This checked-in version changes only path portability and loopback binding. Captures were not rerun after that portability edit. Do not treat the fixture as a regression suite; use the full audit harness for fixes involving server/editor/navigation behavior.

# Browser checks

Use the browser-check kit in `scripts/browser/` for one-off Playwright scripts that check a running app: layout at a width, hover cards, dialogs, or a mobile toolbar. For a regression that should run in CI, write a spec in `tests/e2e/` instead.

## Start from the template

```sh
cp scripts/browser/example-check.mjs tmp/my-check.mjs   # then fix the import to ../scripts/browser/kit.mjs
node tmp/my-check.mjs --base http://127.0.0.1:3334 /tasks
```

A check looks like this:

```js
import { run } from "../scripts/browser/kit.mjs";

await run(async (app) => {
  const page = await app.page({ width: 390 });
  await app.visit(page, "/tasks");
  const bar = await app.box(page.getByRole("toolbar"));
  app.check("toolbar fits", bar !== null && bar.width <= 390, bar);
  await app.shot(page, "tasks-390");
});
```

`run` exits 1 when a check fails, the body throws, or a page logs a console error or uncaught exception. You can trust the exit code without reading the output.

## What the kit does for you

| Need                              | Use                                                                                                        | Instead of                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Server URL                        | `--base`, else `PLAYWRIGHT_BASE_URL`, else `127.0.0.1:$PORT` (3100)                                        | A port hard-coded in the script            |
| Signed-in session                 | Automatic. Signs in once per server and caches it in `tmp/browser/auth-<host>-<port>.json` (0600)          | Sign-in code copied into each script       |
| Page ready                        | `app.visit(page, route)` waits for `html[data-app-hydrated="true"]`                                        | `waitForTimeout(3000)` or `networkidle`    |
| After a hover, click, or keypress | `await app.settle(page)` waits for fonts, finite animations, and two frames                                | `waitForTimeout(700)`                      |
| An element to appear              | `await locator.waitFor()` or `expect(locator).toBeVisible()`                                               | A sleep, then a check                      |
| Several widths                    | `app.eachWidth([1440, 800, 390], async (page, width) => …)`                                                | A hand-written loop over contexts          |
| Phone emulation                   | `app.page({ width: 390 })`. Below 600px it also sets `isMobile` and `hasTouch`                             | —                                          |
| Dark mode                         | `app.page({ dark: true })`                                                                                 | —                                          |
| Geometry                          | `await app.box(locator)` returns a rounded rect, or `null` when hidden                                     | `boundingBox()` plus rounding              |
| Layout problems                   | `await app.layout(page)`: overflow, clipped text, overlaps, small targets                                  | Copying the `audit:shoot` measure function |
| Screenshot                        | `await app.shot(page, "name")` writes `tmp/browser/<script>/name.png`                                      | —                                          |
| Before/after image                | `await app.compare("name", [{ label: "Before", path }, { label: "After", path }])` writes one labelled PNG | ImageMagick (`magick` isn't installed)     |
| Script arguments                  | `app.args` (positional arguments after the flags)                                                          | Parsing `process.argv`                     |
| Known noisy errors                | `run(fn, { ignoreErrors: [/ResizeObserver loop/] })`                                                       | Filtering by hand                          |

## Extend the kit

Add a helper to `app` in `scripts/browser/kit.mjs` when two scripts would otherwise copy the same code. Keep each helper small, give it a one-line doc comment, and add a row to the table above. Put page-side measurement in its own module, as `layout.mjs` does, so `audit:shoot` and checks can share it. Pure helpers get a unit test in `tests/unit/browser-kit.test.ts`.

The kit is plain `.mjs`, so `node tmp/x.mjs` runs it without a TypeScript loader. `credential.mjs` is the single credential reader; the e2e suite re-exports it.

## Speed notes

- Keep one dev server running per worktree (`pnpm audit:harness`, see [audit-harness.md](audit-harness.md)) and point every check at it. The first visit to a route compiles it; later visits take about 1s.
- Chromium starts in about 0.4s, so every check launches its own browser. The time goes to fixed sleeps, signing in again, and cold routes, and the kit removes the first two.
- `pnpm audit:shoot` is built on the kit. Use it for screenshot sweeps across routes and widths.

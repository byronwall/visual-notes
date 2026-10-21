// Browser-check kit: the shared setup for one-off Playwright scripts that
// check a running app (layout, hover cards, dialogs, mobile toolbars).
//
//   import { run } from "../scripts/browser/kit.mjs";
//   await run(async (app) => {
//     const page = await app.page({ width: 390 });
//     await app.visit(page, "/tasks");
//     app.check("toolbar fits", (await app.box(page.getByRole("toolbar")))?.width <= 390);
//     await app.shot(page, "tasks-390");
//   });
//
// `run` signs in once per server (cached in tmp/browser/), waits for the
// hydration marker instead of fixed sleeps, collects console and page errors,
// and exits non-zero when a check fails or the page logged an error.
// See docs/browser-checks.md.
import { chromium } from "@playwright/test";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { readTestCredential } from "./credential.mjs";
import { layoutProblems, layoutReport } from "./layout.mjs";

const NAV_TIMEOUT_MS = 120_000; // A cold `vinxi dev` compiles a route on first visit.
const READY_TIMEOUT_MS = 60_000;

/**
 * Options come from the call, then `--base`/`--out` flags, then the
 * environment. Unknown flags are left for the script (see `app.args`).
 * @param {{ base?: string, out?: string }} options
 */
export const resolveOptions = (
  options = {},
  argv = process.argv.slice(2),
  env = process.env,
) => {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { base: { type: "string" }, out: { type: "string" } },
    strict: false,
    allowPositionals: true,
  });
  const base =
    options.base ??
    values.base ??
    env.PLAYWRIGHT_BASE_URL ??
    `http://127.0.0.1:${env.PORT ?? "3100"}`;
  const script = basename(process.argv[1] ?? "check").replace(/\.[^.]+$/, "");
  const out = options.out ?? values.out ?? `tmp/browser/${script}`;
  return { base: base.replace(/\/$/, ""), out, args: positionals };
};

const authPathFor = (base) => {
  const { hostname, port } = new URL(base);
  return `tmp/browser/auth-${hostname}-${port || "80"}.json`;
};

/** @param {import("@playwright/test").Page} page */
export const waitForAppReady = (page) =>
  page.waitForSelector('html[data-app-hydrated="true"]', {
    state: "attached",
    timeout: READY_TIMEOUT_MS,
  });

const signIn = async (browser, base, authPath) => {
  const context = await browser.newContext({
    baseURL: base,
    storageState: existsSync(authPath) ? authPath : undefined,
  });
  try {
    const page = await context.newPage();
    await page.goto("/", {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });
    if (new URL(page.url()).pathname !== "/login") return;
    const password = readTestCredential();
    if (!password) {
      throw new Error(
        "[browser] signed out and no test credential: set PLAYWRIGHT_MAGIC_PASSWORD_FILE or MAGIC_PASSWORD.",
      );
    }
    // Typing before hydration gets wiped when Solid takes over the input.
    await waitForAppReady(page);
    await page.getByRole("textbox").first().fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => url.pathname !== "/login", {
      timeout: 30_000,
    });
  } finally {
    mkdirSync("tmp/browser", { recursive: true });
    await context.storageState({ path: authPath });
    chmodSync(authPath, 0o600);
    await context.close();
  }
};

/**
 * Opens a browser against a running app and returns the helpers a check
 * script needs. Prefer `run`, which also closes it and sets the exit code.
 * @param {{ base?: string, out?: string, auth?: boolean, ignoreErrors?: RegExp[] }} options
 */
export const openApp = async (options = {}) => {
  const { base, out, args } = resolveOptions(options);
  const ignoreErrors = options.ignoreErrors ?? [];
  const browser = await chromium.launch();
  const authPath = authPathFor(base);
  if (options.auth !== false) await signIn(browser, base, authPath);
  mkdirSync(out, { recursive: true });

  const failures = [];
  const pageErrors = [];

  const app = {
    base,
    out,
    /** Positional arguments the script was given (after `--base`/`--out`). */
    args,
    browser,

    /**
     * A fresh signed-in page. `page.errors` collects console errors and
     * uncaught exceptions; `run` fails the script if any remain.
     * @param {{ width?: number, height?: number, dark?: boolean, mobile?: boolean, scale?: number, auth?: boolean }} view
     */
    async page(view = {}) {
      const width = view.width ?? 1440;
      const mobile = view.mobile ?? width < 600;
      const context = await browser.newContext({
        baseURL: base,
        storageState:
          view.auth === false || options.auth === false ? undefined : authPath,
        viewport: { width, height: view.height ?? (mobile ? 844 : 900) },
        colorScheme: view.dark ? "dark" : "light",
        isMobile: mobile,
        hasTouch: mobile,
        deviceScaleFactor: view.scale ?? 1,
      });
      context.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
      const page = await context.newPage();
      const errors = [];
      const keep = (text) => {
        if (ignoreErrors.some((pattern) => pattern.test(text))) return;
        errors.push(text.slice(0, 300));
        pageErrors.push(`${width}px ${page.url()}: ${text.slice(0, 300)}`);
      };
      page.on(
        "console",
        (message) => message.type() === "error" && keep(message.text()),
      );
      page.on("pageerror", (error) => keep(error.message));
      return Object.assign(page, { errors });
    },

    /** Navigates and waits until every server-rendered node is hydrated. Returns ms. */
    async visit(page, route) {
      const started = Date.now();
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await waitForAppReady(page);
      return Date.now() - started;
    },

    /**
     * Waits for fonts, running CSS animations and transitions, and two frames.
     * Use it after an interaction instead of `waitForTimeout`.
     */
    async settle(page) {
      await page.evaluate(async () => {
        await document.fonts.ready;
        const running = document
          .getAnimations()
          .filter((a) => a.playState === "running");
        const finite = running.filter(
          (a) => a.effect?.getComputedTiming().endTime !== Infinity,
        );
        await Promise.race([
          Promise.allSettled(finite.map((a) => a.finished)),
          new Promise((resolve) => setTimeout(resolve, 2_000)),
        ]);
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
      });
    },

    /** Saves `<out>/<name>.png` and returns the path. */
    async shot(page, name, { fullPage = false } = {}) {
      const path = `${out}/${name}.png`;
      await page.screenshot({ path, fullPage });
      console.log(`[browser] shot ${path}`);
      return path;
    },

    /** Rounded bounding box, or null when the element is missing or hidden. */
    async box(locator) {
      const box = await locator.boundingBox().catch(() => null);
      if (!box) return null;
      return {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    },

    /** Records a pass/fail line. A failed check makes the script exit 1. */
    check(label, ok, detail) {
      const suffix = detail === undefined ? "" : ` ${JSON.stringify(detail)}`;
      console.log(`[check] ${ok ? "ok  " : "FAIL"} ${label}${suffix}`);
      if (!ok) failures.push(label);
      return Boolean(ok);
    },

    /** Prints a labelled value; objects are printed as one JSON line. */
    log(label, value) {
      const text = typeof value === "string" ? value : JSON.stringify(value);
      console.log(`[browser] ${label}${value === undefined ? "" : ` ${text}`}`);
    },

    /** Overflow, clipping, overlap, and small-target report for the page. */
    async layout(page, label = new URL(page.url()).pathname) {
      const report = await layoutReport(page);
      const problems = layoutProblems(report);
      console.log(`[layout] ${label} ${problems.join(", ") || "ok"}`);
      return { ...report, problems };
    },

    /** Runs `fn` once per width with a fresh page, closing each afterwards. */
    async eachWidth(widths, fn, view = {}) {
      for (const width of widths) {
        const page = await app.page({ ...view, width });
        try {
          await fn(page, width);
        } finally {
          await page.context().close();
        }
      }
    },

    /** Closes the browser and returns the number of problems found. */
    async close() {
      await browser.close();
      for (const line of pageErrors)
        console.log(`[browser] page error ${line}`);
      const problems = failures.length + pageErrors.length;
      console.log(
        `[browser] done: ${failures.length} failed checks, ${pageErrors.length} page errors`,
      );
      return problems;
    },
  };
  return app;
};

/**
 * Opens the app, runs `fn`, always closes the browser, and sets the exit code:
 * 1 when `fn` throws, a check fails, or a page logged an error.
 * @param {(app: Awaited<ReturnType<typeof openApp>>) => Promise<void>} fn
 * @param {Parameters<typeof openApp>[0]} options
 */
export const run = async (fn, options = {}) => {
  const app = await openApp(options);
  let threw = false;
  try {
    await fn(app);
  } catch (error) {
    threw = true;
    console.error(`[browser] check threw: ${error?.stack ?? error}`);
  }
  const problems = await app.close();
  if (threw || problems > 0) process.exitCode = 1;
};

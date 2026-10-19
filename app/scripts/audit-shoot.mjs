// Screenshot routes at several widths and print a text layout report, so an
// agent can check layout even when it cannot view the images.
//
//   pnpm audit:shoot -- --base http://127.0.0.1:3115 --routes "/,/tasks" \
//     [--widths 1440,800,390] [--out tmp/shots/after] [--dark] [--full]
//
// Signs in with PLAYWRIGHT_MAGIC_PASSWORD_FILE, MAGIC_PASSWORD, or MAGIC_PASSWORD
// in ./.env (local dev only), and caches the session in <out>/auth.json. Never
// prints the credential. Writes <out>/report.json and one line per shot.
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const base = opt("base", "http://127.0.0.1:3100");
const out = opt("out", "tmp/shots");
const routes = opt("routes", "/").split(",");
const widths = opt("widths", "1440,390").split(",").map(Number);
const dark = args.includes("--dark");
const full = args.includes("--full");
const authPath = `${out}/auth.json`;

const readPassword = () => {
  const file = process.env.PLAYWRIGHT_MAGIC_PASSWORD_FILE;
  if (file) return readFileSync(file, "utf8").trim();
  if (process.env.MAGIC_PASSWORD) return process.env.MAGIC_PASSWORD;
  if (!existsSync(".env")) return "";
  const line = readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("MAGIC_PASSWORD="));
  return line?.slice("MAGIC_PASSWORD=".length).replace(/^["']|["']$/g, "") ?? "";
};

const signIn = async (browser) => {
  const ctx = await browser.newContext({
    baseURL: base,
    storageState: existsSync(authPath) ? authPath : undefined,
  });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.waitForLoadState("networkidle").catch(() => {});
  if (new URL(page.url()).pathname === "/login") {
    // Wait for hydration so the typed password is not wiped.
    await page.waitForTimeout(1500);
    await page.getByRole("textbox").first().fill(readPassword());
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((u) => u.pathname !== "/login", { timeout: 15000 });
  }
  await ctx.storageState({ path: authPath });
  await ctx.close();
};

// Runs in the page. Keep it self-contained.
const measure = () => {
  const vw = window.innerWidth;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && s.visibility !== "hidden" && s.opacity !== "0";
  };
  // Content inside its own scroller (calendar grids, tables) may extend past
  // the viewport on purpose.
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).overflowX !== "visible") return true;
    }
    return false;
  };
  const label = (el) => {
    const name =
      el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 40) || "";
    const cls = typeof el.className === "string" ? el.className.split(" ")[0] : "";
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${name ? ` "${name}"` : ""}`;
  };
  const all = [...document.body.querySelectorAll("*")].filter(visible);
  const offscreen = all
    .filter((el) => el.getBoundingClientRect().right > vw + 1 && !inScroller(el))
    .filter((el) => !all.some((p) => p !== el && p.contains(el) && p.getBoundingClientRect().right > vw + 1))
    .slice(0, 5)
    .map(label);
  const clipped = all
    .filter((el) => el.children.length === 0 && el.scrollWidth > el.clientWidth + 1)
    .filter((el) => getComputedStyle(el).textOverflow !== "ellipsis")
    .slice(0, 5)
    .map(label);
  const targets = [
    ...document.querySelectorAll("a[href],button,input,select,textarea,[role=button],[tabindex='0']"),
  ].filter(visible).slice(0, 400);
  const overlaps = [];
  for (let i = 0; i < targets.length && overlaps.length < 5; i++) {
    const a = targets[i].getBoundingClientRect();
    for (let j = i + 1; j < targets.length; j++) {
      if (targets[i].contains(targets[j]) || targets[j].contains(targets[i])) continue;
      const b = targets[j].getBoundingClientRect();
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 4 && h > 4) {
        overlaps.push(`${label(targets[i])} x ${label(targets[j])}`);
        break;
      }
    }
  }
  const small = targets.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width < 24 || r.height < 24;
  });
  return {
    horizontalOverflow: document.documentElement.scrollWidth > vw + 1,
    offscreen,
    clipped,
    overlaps,
    smallTargets: vw < 600 ? small.slice(0, 5).map(label) : [],
  };
};

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
await signIn(browser);
const report = [];
for (const width of widths) {
  const ctx = await browser.newContext({
    baseURL: base,
    storageState: authPath,
    viewport: { width, height: width < 600 ? 844 : 900 },
    colorScheme: dark ? "dark" : "light",
  });
  const page = await ctx.newPage();
  let errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  for (const route of routes) {
    errors = [];
    const started = Date.now();
    await page.goto(route);
    await page.waitForLoadState("networkidle").catch(() => {});
    const loadMs = Date.now() - started;
    await page.waitForTimeout(500);
    const slug = route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home";
    const file = `${out}/${slug}-${width}${dark ? "-dark" : ""}.png`;
    await page.screenshot({ path: file, fullPage: full });
    const entry = { route, width, file, loadMs, errors, ...(await page.evaluate(measure)) };
    report.push(entry);
    const problems = [
      entry.errors.length && `${entry.errors.length} errors`,
      entry.horizontalOverflow && "h-overflow",
      entry.offscreen.length && `${entry.offscreen.length} offscreen`,
      entry.clipped.length && `${entry.clipped.length} clipped`,
      entry.overlaps.length && `${entry.overlaps.length} overlaps`,
      entry.smallTargets.length && `${entry.smallTargets.length} small targets`,
    ].filter(Boolean);
    console.log(`[audit-shoot] ${route} @${width} ${loadMs}ms ${problems.join(", ") || "ok"} -> ${file}`);
  }
  await ctx.close();
}
await browser.close();
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(`[audit-shoot] details: ${out}/report.json`);

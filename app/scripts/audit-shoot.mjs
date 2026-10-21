// Screenshot routes at several widths and print a text layout report, so an
// agent can check layout even when it cannot view the images.
//
//   pnpm audit:shoot -- --base http://127.0.0.1:3115 --routes "/,/tasks" \
//     [--widths 1440,800,390] [--out tmp/shots/after] [--dark] [--full]
//
// Built on the browser-check kit (scripts/browser/kit.mjs), which signs in
// once per server and never prints the credential. Writes <out>/report.json
// and one line per shot.
import { writeFileSync } from "node:fs";
import { openApp } from "./browser/kit.mjs";
import { layoutProblems, layoutReport } from "./browser/layout.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const routes = opt("routes", "/").split(",");
const widths = opt("widths", "1440,390").split(",").map(Number);
const dark = args.includes("--dark");
const full = args.includes("--full");

const app = await openApp({
  base: opt("base", "http://127.0.0.1:3100"),
  out: opt("out", "tmp/shots"),
});
const report = [];
try {
  await app.eachWidth(
    widths,
    async (page, width) => {
      for (const route of routes) {
        page.errors.length = 0;
        const loadMs = await app.visit(page, route);
        await app.settle(page);
        const slug =
          route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home";
        const file = `${app.out}/${slug}-${width}${dark ? "-dark" : ""}.png`;
        await page.screenshot({ path: file, fullPage: full });
        const layout = await layoutReport(page);
        report.push({
          route,
          width,
          file,
          loadMs,
          errors: [...page.errors],
          ...layout,
        });
        const issues = [
          page.errors.length && `${page.errors.length} errors`,
          ...layoutProblems(layout),
        ].filter(Boolean);
        console.log(
          `[audit-shoot] ${route} @${width} ${loadMs}ms ${issues.join(", ") || "ok"} -> ${file}`,
        );
      }
    },
    { dark },
  );
} finally {
  await app.close();
}
writeFileSync(`${app.out}/report.json`, JSON.stringify(report, null, 2));
console.log(`[audit-shoot] details: ${app.out}/report.json`);

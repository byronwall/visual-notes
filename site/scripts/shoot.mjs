// Screenshots for the landing page, taken from the demo database
// visual_notes_audit_portfolio_demo (see app/docs/audit-harness.md). The ids
// below belong to that database. Run from app/ against the harness server:
//
//   SHOTS=voice,tasks node ../site/scripts/shoot.mjs --base http://127.0.0.1:<port>
//
// It hides the sidebar's Recent list and the dev toolbar. Convert the PNGs in
// app/tmp/landing/ with cwebp; feature shots crop the 512px sidebar:
//   cwebp -q 82 -crop 512 0 2368 1800 tmp/landing/voice.png -o ../site/public/shots/voice.webp
import { run } from "../../app/scripts/browser/kit.mjs";
const shots = (process.env.SHOTS ?? "").split(",").filter(Boolean);
const all = {
  notes: "/",
  voice: "/docs/cmwoejwqz004q8c57bomjadbp",
  voice2: "/docs/cmwoek1qk004x8c57bw32lxed",
  editor: "/docs/cmwoejvzo00078c574xw3ngoc",
  tasks: "/tasks",
  canvas: "/canvas",
  research: "/research/cmwoekabg00018csw8spg7neb",
  collection: "/collections/cmwoekdnw00098cjmo4j86bb2",
  collection2: "/collections/cmwoekdoc000g8cjmn89k1q4w",
  people: "/people",
  cleanup: "/cleanup",
  events: "/events",
  inbox: "/inbox",
};
const hide = `
  section[aria-label="Recent"] { visibility: hidden !important; }
`;
await run(async (app) => {
  const page = await app.page({ width: 1440, height: 900, scale: 2 });
  for (const [name, route] of Object.entries(all)) {
    if (shots.length && !shots.includes(name)) continue;
    await app.visit(page, route);
    await app.settle(page);
    await page.addStyleTag({ content: hide });
    await page.evaluate(() => {
      let el = document.elementFromPoint(60, 860);
      while (el && el.parentElement && el.parentElement !== document.body) el = el.parentElement;
      if (el && el.id !== "app") el.style.display = "none";
    });
    if (name === "research") {
      await page.getByRole("button", { name: "Expand all" }).click();
      await page.waitForTimeout(800);
      const zoomIn = page.getByRole("button", { name: /zoom in/i });
      if (await zoomIn.count()) await zoomIn.first().click();
    }
    if (name.startsWith("voice")) await page.getByText(/^Transcript/).first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `tmp/landing/${name}.png` });
    console.log("shot", name);
  }
});

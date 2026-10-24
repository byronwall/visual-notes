import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { createResearchTopicFixture, uniqueSuffix } from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";

// Drives the real topic canvas: hulls for draft summaries, accepting them,
// semantic zoom folding, open cards piercing folds, selection, and nudges.
// Set RESEARCH_SHOTS_DIR to also save screenshots of each level.

const FIXTURE = resolve(process.cwd(), "tests/fixtures/research/learn-rust-async.json");
const shots = process.env.RESEARCH_SHOTS_DIR;

const shoot = async (page: Page, name: string) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png` });
};

const canvas = (page: Page) => page.getByTestId("research-canvas");
const cardByTitle = (page: Page, title: string) =>
  page.getByTestId("research-canvas-card").filter({ hasText: title });

test.describe("research topic canvas", () => {
  test.use({ viewport: { width: 1600, height: 1000 } });

  test("folds accepted summaries as you zoom out and keeps open work visible", async ({ page, request }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const topic = await createResearchTopicFixture(request, FIXTURE, `Canvas e2e ${uniqueSuffix()}`);

    await page.goto(`/research/${topic.slug}`);
    await waitForAppReady(page);
    await expect(canvas(page)).toHaveAttribute("data-level", "0");
    await expect(page.getByTestId("research-canvas-card")).toHaveCount(38);
    await expect(page.getByTestId("research-canvas-hull")).toHaveCount(4);
    await shoot(page, "canvas-detail-drafts");

    // Drafts never fold, so there are no zoom levels yet; the toolbar offers review instead.
    await expect(page.getByRole("button", { name: "Summaries", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "4 summaries to review" }).click();
    const detail = page.getByTestId("research-card-detail");
    await expect(detail.getByText("Draft summary.")).toBeVisible();
    await expect(page.getByTestId("research-canvas-hull").and(page.locator("[data-selected=true]"))).toHaveCount(1);
    await expect(page.getByTestId("research-canvas-card")).toHaveCount(38);

    // Fit shows every hull label; accepting a leaf summary may fold it right away.
    await page.getByRole("button", { name: "Fit", exact: true }).click();
    const hullAccept = page.getByTestId("research-canvas-hull").getByRole("button", { name: "Accept", exact: true });
    for (let i = 0; i < 4; i++) {
      await hullAccept.first().click();
      await expect(hullAccept).toHaveCount(3 - i);
    }
    await expect(page.getByRole("button", { name: /to review/ })).toHaveCount(0);
    await shoot(page, "canvas-detail-accepted");

    await page.getByRole("button", { name: "Summaries", exact: true }).click();
    await expect(canvas(page)).toHaveAttribute("data-level", "1");
    await expect(cardByTitle(page, "Pin: moving is the hazard")).toBeVisible();
    await expect(cardByTitle(page, "Why are futures lazy?")).toHaveCount(0);
    // Open questions inside a folded group pierce the fold.
    await expect(cardByTitle(page, "How does a waker reach the I/O reactor?")).toBeVisible();
    await shoot(page, "canvas-summaries");

    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await expect(canvas(page)).toHaveAttribute("data-level", "2");
    await expect(cardByTitle(page, "Async Rust: poll-driven state machines")).toBeVisible();
    await expect(cardByTitle(page, "Pin: moving is the hazard")).toHaveCount(0);
    await expect(cardByTitle(page, "Do the Tokio mini-redis tutorial")).toBeVisible();
    await shoot(page, "canvas-overview");

    // Selecting a folded summary shows what it covers; selection lives in the URL.
    await cardByTitle(page, "Async Rust: poll-driven state machines").click();
    await expect(detail.getByRole("heading", { name: "Covers" })).toBeVisible();
    await expect(page).toHaveURL(/card=/);
    await shoot(page, "canvas-overview-selected");

    expect(errors).toEqual([]);
  });

  test("dragging a card saves a nudge that survives reload", async ({ page, request }) => {
    const topic = await createResearchTopicFixture(request, FIXTURE, `Canvas nudge ${uniqueSuffix()}`);
    await page.goto(`/research/${topic.slug}`);
    await waitForAppReady(page);
    // Fit picks a new scale after a nudge grows the bounds, so measure at 100%.
    const atDetail = async () => {
      await page.getByRole("button", { name: /reset to 100%/ }).click();
      await expect(page.getByRole("toolbar", { name: "Canvas view" }).getByText("100%")).toBeVisible();
    };
    await atDetail();
    const card = cardByTitle(page, "Try the pin! macro in a small example");
    const anchor = cardByTitle(page, "Why does Pin exist?");
    // Fit re-centers on reload, so compare against an unmoved card.
    const relative = async () => {
      const [a, b] = [(await card.boundingBox())!, (await anchor.boundingBox())!];
      return { x: a.x - b.x, y: a.y - b.y };
    };
    const startRel = await relative();
    const before = (await card.boundingBox())!;
    const nudgeSaved = page.waitForResponse((response) => response.url().includes("/_server") && response.request().method() === "POST");
    await page.mouse.move(before.x + 20, before.y + 10);
    await page.mouse.down();
    await page.mouse.move(before.x + 60, before.y + 70, { steps: 6 });
    await page.mouse.up();
    await nudgeSaved;
    const moved = await relative();
    expect(moved.y - startRel.y).toBeGreaterThan(30);
    // A drag is not a click: nothing got selected.
    await expect(page).not.toHaveURL(/card=/);

    await page.reload();
    await waitForAppReady(page);
    await atDetail();
    const after = await relative();
    expect(Math.abs(after.y - moved.y)).toBeLessThan(2);
    expect(Math.abs(after.x - moved.x)).toBeLessThan(2);
  });

  test("a busy branch wraps into labeled type lanes that fit the viewport", async ({ page, request }) => {
    const wide = resolve(process.cwd(), "tests/fixtures/research/wide-comparison.json");
    const topic = await createResearchTopicFixture(request, wide, `Lanes e2e ${uniqueSuffix()}`);
    await page.goto(`/research/${topic.slug}`);
    await waitForAppReady(page);
    const lanes = page.getByTestId("research-canvas-lane");
    await expect(lanes).toHaveText([/Criteria\s*1/, /Options\s*9/, /Findings\s*1/, /Questions\s*6/, /Sources\s*1/]);
    // Opens at a readable zoom with the lanes side by side, not one tall column.
    const zoom = Number((await page.getByRole("button", { name: /reset to 100%/ }).innerText()).replace("%", ""));
    expect(zoom).toBeGreaterThanOrEqual(60);
    const options = (await lanes.nth(1).boundingBox())!;
    const questions = (await lanes.nth(3).boundingBox())!;
    expect(questions.x).toBeGreaterThan(options.x + 100);
    await shoot(page, "canvas-lanes");

    // Searching the contents dims the canvas and highlights the match.
    await page.getByLabel("Search cards").fill("northwind");
    await expect(page.getByTestId("research-contents-row")).toHaveCount(5);
    await expect(page.locator("[data-dimmed=true]").first()).toBeAttached();
    await expect(page.getByTestId("research-contents").locator("mark").first()).toHaveText(/northwind/i);
    await page.getByTestId("research-contents-row").filter({ hasText: "Northwind lower deductibles" }).click();
    const detail = page.getByTestId("research-card-detail");
    await expect(detail.getByRole("heading", { name: "Northwind lower deductibles" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Card" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Contents" }).click();
    await expect(page.getByLabel("Search cards")).toHaveValue("northwind");
  });

  test("outline view lists the same cards and opens details", async ({ page, request }) => {
    const topic = await createResearchTopicFixture(request, FIXTURE, `Outline e2e ${uniqueSuffix()}`);
    await page.goto(`/research/${topic.slug}?view=outline`);
    await waitForAppReady(page);
    await expect(page.getByTestId("research-outline-row")).toHaveCount(38);
    await page.getByTestId("research-outline-row").filter({ hasText: "Why does Pin exist?" }).getByText("Why does Pin exist?").click();
    await expect(page.getByTestId("research-card-detail").getByRole("heading", { name: "Led to" })).toBeVisible();

    // Collapsing a branch hides its rows and says how many are below.
    await page.getByRole("button", { name: "Collapse all" }).click();
    await expect(page.getByTestId("research-outline-row")).toHaveCount(1);
    await page.getByRole("button", { name: "Expand all" }).click();
    await expect(page.getByTestId("research-outline-row")).toHaveCount(38);
  });
});

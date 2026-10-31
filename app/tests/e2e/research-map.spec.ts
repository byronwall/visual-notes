import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createResearchTopicFixture, uniqueSuffix } from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";

// Drives the topic map, the default view: condensed on first open, branches
// that open on demand, the reader on a card, search, keys, and the view switch.

const fixture = resolve(
  process.cwd(),
  "tests/fixtures/research/insurance-streams.json",
);

test.describe("research topic map", () => {
  test.use({ viewport: { width: 1600, height: 1000 } });

  test("opens condensed and shows text only in the reader", async ({
    page,
    request,
  }) => {
    const topic = await createResearchTopicFixture(
      request,
      fixture,
      `Map e2e ${uniqueSuffix()}`,
    );
    await page.goto(`/research/${topic.slug}`);
    await waitForAppReady(page);

    const map = page.getByTestId("research-map");
    const nodes = (kind: string) => map.locator(`[data-kind=${kind}]`);
    await expect(nodes("stream")).toHaveCount(3);
    await expect(nodes("card")).toHaveCount(0);
    await expect(page.locator("aside")).toBeHidden();
    await expect(page.locator("main")).not.toContainText("Paragraph 1 about");

    // Opening one branch leaves the root where it was.
    const root = await nodes("root").boundingBox();
    const pick = nodes("stream").filter({ hasText: "Pick a carrier" });
    await pick.click();
    await expect(nodes("section")).not.toHaveCount(0);
    expect(await nodes("root").boundingBox()).toEqual(root);

    await nodes("section").filter({ hasText: "Options" }).click();
    await nodes("card").filter({ hasText: "Carrier A draft" }).click();
    await expect(page).toHaveURL(/card=/);
    await expect(page.getByTestId("research-card-detail")).toBeVisible();
    await expect(page.locator("main")).not.toContainText("Paragraph 1 about");

    // A share link lands on the same card with its branch open.
    await page.reload();
    await waitForAppReady(page);
    await expect(map.locator("[data-selected=true]")).toContainText(
      "Carrier A draft",
    );

    await page.keyboard.press("Escape");
    // A trip to Board keeps what was open.
    await page.getByRole("tab", { name: "Board" }).click();
    await expect(page).toHaveURL(/view=board/);
    await page.getByRole("tab", { name: "Map" }).click();
    await expect(nodes("section")).not.toHaveCount(0);

    await page.getByRole("tab", { name: "Board" }).click();
    await page.reload();
    await waitForAppReady(page);
    await expect(page.getByTestId("research-board")).toBeVisible();
    await page.getByRole("tab", { name: "Map" }).click();
    await expect(page).not.toHaveURL(/view=/);

    // Search opens the branch that holds a match and dims the rest.
    await map.locator("..").getByLabel("Search cards").fill("deductibles");
    await expect(
      nodes("card").filter({ hasText: "Higher deductibles" }),
    ).toHaveAttribute("data-dimmed", "false");
    await expect(
      nodes("stream").filter({ hasText: "Home baseline" }),
    ).toHaveAttribute("data-dimmed", "true");
  });

  test("works by keyboard", async ({ page, request }) => {
    const topic = await createResearchTopicFixture(
      request,
      fixture,
      `Map keys e2e ${uniqueSuffix()}`,
    );
    await page.goto(`/research/${topic.slug}`);
    await waitForAppReady(page);

    const focused = page.locator(":focus");
    await page.getByTestId("research-map").locator("[data-kind=root]").focus();
    await page.keyboard.press("ArrowRight");
    await expect(focused).toHaveAttribute("data-kind", "stream");
    await page.keyboard.press("Enter");
    await expect(focused).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("ArrowRight");
    await expect(focused).toHaveAttribute("data-kind", "section");
    await page.keyboard.press(" ");
    await page.keyboard.press("ArrowRight");
    await expect(focused).toHaveAttribute("data-kind", "card");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/card=/);
  });

  test("steps through search matches and keeps branches on reload", async ({
    page,
    request,
  }) => {
    const topic = await createResearchTopicFixture(
      request,
      fixture,
      `Map steps e2e ${uniqueSuffix()}`,
    );
    await page.goto(`/research/${topic.slug}`);
    await waitForAppReady(page);

    const map = page.getByTestId("research-map");
    await map.locator("[data-kind=stream]").first().click();
    await expect(map.locator("[data-kind=section]")).not.toHaveCount(0);
    const open = await map.locator("[data-kind=section]").count();
    await page.reload();
    await waitForAppReady(page);
    await expect(map.locator("[data-kind=section]")).toHaveCount(open);

    await page.keyboard.press("/");
    const search = map.locator("..").getByLabel("Search cards");
    await search.fill("carrier");
    const counter = map.locator("..").getByRole("toolbar");
    await search.press("Enter");
    await expect(page).toHaveURL(/card=/);
    await expect(counter).toContainText(/1 of \d+/);
    await expect(search).toBeFocused();
    await search.press("Enter");
    await expect(counter).toContainText(/2 of \d+/);
    await search.press("Shift+Enter");
    await expect(counter).toContainText(/1 of \d+/);
  });

  test("shows a folding tree on a phone", async ({ page, request }) => {
    const topic = await createResearchTopicFixture(
      request,
      fixture,
      `Map phone e2e ${uniqueSuffix()}`,
    );
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(`/research/${topic.slug}`);
    await waitForAppReady(page);

    await expect(page.getByTestId("research-map")).toBeHidden();
    const rows = page.getByTestId("research-map-row");
    await expect(rows).toHaveCount(3);
    await rows.filter({ hasText: "Home baseline" }).click();
    await rows.filter({ hasText: "homeowners baseline" }).click();
    await expect(page.getByTestId("research-card-detail")).toBeVisible();
  });
});

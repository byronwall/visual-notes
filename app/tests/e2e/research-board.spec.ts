import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { createResearchTopicFixture, uniqueSuffix } from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";

// Drives the stream board: one column per declared stream, fixed blocks,
// nested answers, blockers on options, the reader's stream navigation, the
// Options table, and older topics without streams. Set RESEARCH_SHOTS_DIR
// to also save screenshots.

const fixture = (name: string) =>
  resolve(process.cwd(), `tests/fixtures/research/${name}.json`);
const shots = process.env.RESEARCH_SHOTS_DIR;

const shoot = async (page: Page, name: string) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png` });
};

const column = (page: Page, key: string) =>
  page.locator(`[data-testid=research-board-column][data-stream="${key}"]`);
const cardByTitle = (page: Page, title: string) =>
  page.getByTestId("research-board-card").filter({ hasText: title }).first();

test.describe("research topic at narrow widths", () => {
  test("the Answer stays readable beside the open inspector", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    const topic = await createResearchTopicFixture(
      request,
      fixture("printer-streams"),
      `Board width ${uniqueSuffix()}`,
    );
    await page.goto(`/research/${topic.slug}?view=board`);
    await waitForAppReady(page);
    await expect(page.locator("aside")).toBeVisible();
    const answer = page
      .getByTestId("research-board")
      .getByRole("heading", { name: "Answer", exact: true })
      .first()
      .locator("..");
    expect((await answer.boundingBox())!.width).toBeGreaterThan(300);
  });

  test("a phone keeps the view full height until a card is picked", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const topic = await createResearchTopicFixture(
      request,
      fixture("printer-streams"),
      `Board phone ${uniqueSuffix()}`,
    );
    await page.goto(`/research/${topic.slug}?view=board`);
    await waitForAppReady(page);
    await expect(page.locator("aside")).toBeHidden();
    await cardByTitle(page, "Entry printer").click();
    await expect(page.locator("aside")).toBeVisible();
  });
});

test.describe("research topic board", () => {
  test.use({ viewport: { width: 1600, height: 1000 } });

  test("lays streams out as columns with options, blockers, and nested answers", async ({
    page,
    request,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const topic = await createResearchTopicFixture(
      request,
      fixture("insurance-streams"),
      `Board e2e ${uniqueSuffix()}`,
    );
    await page.goto(`/research/${topic.slug}?view=board`);
    await waitForAppReady(page);
    await page.getByRole("button", { name: "Detailed" }).click();

    await expect(page.getByTestId("research-board-column")).toHaveCount(3);
    await expect(column(page, "pick").locator("h2")).toHaveText(
      "Pick a carrier",
    );
    await expect(column(page, "pick")).toContainText(
      "Carrier B is the closest documented core match",
    );
    await expect(column(page, "pick").locator("h3")).toHaveText([
      /Answer/,
      /Options\s*9/,
      /Questions\s*6/,
      /Tasks\s*1/,
    ]);
    const carrierA = cardByTitle(page, "Carrier A draft");
    await expect(carrierA).toContainText("Premium");
    await expect(carrierA).toContainText("Blocked by");
    // The finding that answers a question nests under it, and its source is a citation.
    const nested = page.locator(
      '[data-testid=research-board-card][data-depth="1"]',
      { hasText: "Carrier A quote needs license verification" },
    );
    await expect(nested).toContainText("1 source");
    await shoot(page, "board-insurance");

    // Hovering an option highlights the questions that block it.
    await carrierA.hover();
    await expect(page.locator("[data-related=true]")).toHaveCount(2);

    // Selecting opens the reader with stream navigation; selection lives in the URL.
    await carrierA.click();
    await expect(page).toHaveURL(/card=/);
    const nav = page.getByRole("navigation", { name: "Stream navigation" });
    await expect(nav).toContainText("1 of");
    await expect(
      page
        .getByTestId("research-card-detail")
        .getByRole("heading", { name: "Blocked by" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Next card" }).click();
    await expect(nav).toContainText("2 of");
    await expect(cardByTitle(page, "Carrier B")).toHaveAttribute(
      "data-selected",
      "true",
    );

    // The column header opens the stream itself.
    await column(page, "pick").locator("button").first().click();
    await expect(page).toHaveURL(/stream=pick/);
    await expect(page.getByTestId("research-stream-detail")).toContainText(
      "A verified final price",
    );
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/stream=/);

    expect(errors).toEqual([]);
  });

  test("compact density and the Options table show the same options", async ({
    page,
    request,
  }) => {
    const topic = await createResearchTopicFixture(
      request,
      fixture("printer-streams"),
      `Board table ${uniqueSuffix()}`,
    );
    await page.goto(`/research/${topic.slug}?view=board`);
    await waitForAppReady(page);
    await expect(page.getByTestId("research-board-column")).toHaveCount(5);
    // Sources back findings, so none of the cited ones is its own row.
    await expect(
      page.getByTestId("research-board-card").filter({ hasText: /^Source / }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Compact" }).click();
    await expect(page.getByTestId("research-board")).toHaveAttribute(
      "data-density",
      "compact",
    );
    await expect(cardByTitle(page, "Entry printer")).not.toContainText(
      "Balanced start",
    );
    await shoot(page, "board-printer-compact");

    await page.getByRole("tab", { name: "Options" }).click();
    await expect(page).toHaveURL(/view=table/);
    const rows = page.getByTestId("research-options-table").locator("tbody tr");
    await expect(rows).toHaveCount(6);
    await expect(
      page.getByTestId("research-options-table").locator("th"),
    ).toContainText(["Option", "Price", "Combo", "Best fit"]);
    await rows.filter({ hasText: "Entry printer" }).click();
    await expect(
      page
        .getByTestId("research-card-detail")
        .getByRole("heading", { name: "Entry printer" }),
    ).toBeVisible();
  });

  test("an older topic without streams gets one column per root", async ({
    page,
    request,
  }) => {
    const topic = await createResearchTopicFixture(
      request,
      fixture("wide-comparison"),
      `Board legacy ${uniqueSuffix()}`,
    );
    await page.goto(`/research/${topic.slug}?view=board`);
    await waitForAppReady(page);
    await expect(
      page.getByTestId("research-board-column").first(),
    ).toBeVisible();

    // Searching the contents dims non-matching rows and highlights the match.
    await page.locator("aside").getByLabel("Search cards").fill("northwind");
    await expect(
      page
        .locator("[data-testid=research-board-card][data-dimmed=true]")
        .first(),
    ).toBeAttached();
    await expect(
      page.getByTestId("research-contents").locator("mark").first(),
    ).toHaveText(/northwind/i);
    await page
      .getByTestId("research-contents-row")
      .filter({ hasText: "Northwind lower deductibles" })
      .click();
    await expect(
      page
        .getByTestId("research-card-detail")
        .getByRole("heading", { name: "Northwind lower deductibles" }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Contents" }).click();
    await page.locator("aside").getByLabel("Search cards").fill("");

    // Keyboard: Enter on a board card selects it, Esc clears.
    await cardByTitle(page, "Harbor Auto: $332").focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/card=/);
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/card=/);
  });

  test("comments for the agent and gist/stream edits from the reader", async ({ page, request }) => {
    const topic = await createResearchTopicFixture(request, fixture("insurance-streams"), `Board comments ${uniqueSuffix()}`);
    await page.goto(`/research/${topic.slug}?view=board`);
    await waitForAppReady(page);
    await page.getByRole("button", { name: "Detailed" }).click();
    await cardByTitle(page, "Carrier G").click();
    const detail = page.getByTestId("research-card-detail");
    const comments = detail.getByTestId("research-comments");
    await comments.getByLabel("New comment").fill("Price looks stale; re-check before Oct 30");
    await comments.getByRole("button", { name: "Add comment" }).click();
    await expect(comments.getByTestId("research-comment")).toHaveCount(1);
    await expect(comments.getByTestId("research-comment")).toHaveAttribute("data-resolved", "false");
    // The board shows an open comment on the card.
    await expect(cardByTitle(page, "Carrier G")).toContainText("1");
    await comments.getByRole("button", { name: "Resolve" }).click();
    await expect(comments.getByTestId("research-comment")).toHaveAttribute("data-resolved", "true");
    await shoot(page, "board-comments");

    // Edit the gist and move the card to another stream; the board follows.
    await detail.getByRole("button", { name: "Edit", exact: true }).click();
    await detail.getByLabel("Card gist").fill("Deferred by Byron.");
    await detail.getByRole("combobox", { name: "Stream" }).click();
    await page.getByRole("option", { name: "Home baseline" }).click();
    await detail.getByRole("button", { name: "Save" }).click();
    await expect(column(page, "home")).toContainText("Carrier G");
    await expect(column(page, "home")).toContainText("Deferred by Byron.");
    await expect(column(page, "pick")).not.toContainText("Carrier G");
  });

  test("an empty topic says how cards arrive", async ({ page, request }) => {
    const topic = await createResearchTopicFixture(
      request,
      fixture("empty"),
      `Empty e2e ${uniqueSuffix()}`,
    );
    await page.goto(`/research/${topic.slug}?view=board`);
    await waitForAppReady(page);
    await expect(page.getByTestId("research-empty")).toContainText(
      "No cards yet",
    );
    await expect(page.getByTestId("research-contents")).toContainText(
      "No cards yet.",
    );
    await expect(page.getByText(/0 open/)).toBeVisible();
  });

  test("outline view lists the same cards and opens details", async ({
    page,
    request,
  }) => {
    const topic = await createResearchTopicFixture(
      request,
      fixture("learn-rust-async"),
      `Outline e2e ${uniqueSuffix()}`,
    );
    await page.goto(`/research/${topic.slug}?view=outline`);
    await waitForAppReady(page);
    await expect(page.getByTestId("research-outline-row")).toHaveCount(38);
    await page
      .getByTestId("research-outline-row")
      .filter({ hasText: "Why does Pin exist?" })
      .getByText("Why does Pin exist?")
      .click();
    await expect(
      page
        .getByTestId("research-card-detail")
        .getByRole("heading", { name: "Answers" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Collapse all" }).click();
    await expect(page.getByTestId("research-outline-row")).toHaveCount(1);
    await page.getByRole("button", { name: "Expand all" }).click();
    await expect(page.getByTestId("research-outline-row")).toHaveCount(38);
  });
});

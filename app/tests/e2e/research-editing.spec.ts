import { expect, test, type APIRequestContext } from "@playwright/test";
import { createResearchTopicFixture, uniqueSuffix } from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";
import { resolve } from "node:path";

// Editing and removing cards, renaming and archiving topics, and an open
// canvas picking up an agent's batch without a reload.

const FIXTURE = resolve(process.cwd(), "tests/fixtures/research/learn-rust-async.json");
const shots = process.env.RESEARCH_SHOTS_DIR;
// Same token the topic fixture uses (the audit harness sets this one).
const token = () => process.env.RESEARCH_AGENT_TOKEN ?? "audit-harness-research-token";

const ingest = (request: APIRequestContext, topicId: string, data: object) =>
  request.post(`/api/research/topics/${topicId}/ingest`, {
    headers: { authorization: `Bearer ${token()}` },
    data,
  });

test.describe("research editing", () => {
  test.use({ viewport: { width: 1600, height: 1000 } });

  test("edits a card, undoes the edit, and removes a card with what came from it", async ({ page, request }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const topic = await createResearchTopicFixture(request, FIXTURE, `Edit e2e ${uniqueSuffix()}`);
    await page.goto(`/research/${topic.slug}?view=outline`);
    await waitForAppReady(page);
    const rows = page.getByTestId("research-outline-row");
    await expect(rows).toHaveCount(38);

    await rows.filter({ hasText: "Why does Pin exist?" }).getByText("Why does Pin exist?").click();
    const detail = page.getByTestId("research-card-detail");
    await detail.getByRole("button", { name: "Edit", exact: true }).click();
    await detail.getByLabel("Card title").fill("Why does Pin exist at all?");
    if (shots) await page.screenshot({ path: `${shots}/card-edit.png` });
    await detail.getByRole("button", { name: "Save", exact: true }).click();
    await expect(detail.getByRole("heading", { name: "Why does Pin exist at all?" })).toBeVisible();
    await expect(rows.filter({ hasText: "Why does Pin exist at all?" })).toHaveCount(1);

    // The edit is a batch by "you"; undo it from history.
    await detail.getByRole("button", { name: "Close details" }).click();
    const editRow = page.getByTestId("research-batch-row").filter({ hasText: "Edited" }).first();
    await expect(editRow).toContainText("you");
    await editRow.getByRole("button", { name: "Undo" }).click();
    await expect(rows.filter({ hasText: "Why does Pin exist?" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "Why does Pin exist at all?" })).toHaveCount(0);

    // Removing a card takes everything under it along.
    await rows.filter({ hasText: "Why does Pin exist?" }).getByText("Why does Pin exist?").click();
    await detail.getByRole("button", { name: "Remove", exact: true }).click();
    const confirm = detail.getByRole("button", { name: /^Remove with \d+ below$/ });
    const below = Number((await confirm.textContent())?.match(/\d+/)?.[0]);
    if (shots) await page.screenshot({ path: `${shots}/card-remove-confirm.png` });
    expect(below).toBeGreaterThan(0);
    await confirm.click();
    await expect(rows).toHaveCount(38 - 1 - below);
    expect(errors).toEqual([]);
  });

  test("renames and archives a topic", async ({ page, request }) => {
    const topic = await createResearchTopicFixture(request, FIXTURE, `Rename e2e ${uniqueSuffix()}`);
    await page.goto(`/research/${topic.slug}`);
    await waitForAppReady(page);
    const renamed = `Renamed ${uniqueSuffix()}`;
    await page.getByRole("button", { name: "Rename topic" }).click();
    await page.getByLabel("Topic title").fill(renamed);
    await page.getByLabel("Topic title").press("Enter");
    await expect(page.getByRole("heading", { name: renamed })).toBeVisible();
    await page.getByRole("button", { name: "Archive topic" }).click();
    await expect(page.getByText("Archived", { exact: true })).toBeVisible();
    if (shots) await page.screenshot({ path: `${shots}/topic-archived.png`, clip: { x: 0, y: 0, width: 1600, height: 120 } });

    await page.goto("/research");
    await waitForAppReady(page);
    const row = page.getByTestId("research-topic-row").filter({ hasText: renamed });
    await expect(row).toHaveCount(0);
    await page.getByLabel("Show archived").check();
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("archived");
  });

  test("an open canvas shows an agent's new batch without a reload", async ({ page, request }) => {
    const topic = await createResearchTopicFixture(request, FIXTURE, `Live e2e ${uniqueSuffix()}`);
    await page.goto(`/research/${topic.slug}?view=outline`);
    await waitForAppReady(page);
    await expect(page.locator("html")).toHaveAttribute("data-note-live", "open");
    const rows = page.getByTestId("research-outline-row");
    await expect(rows).toHaveCount(38);

    const title = `Agent finding ${uniqueSuffix()}`;
    const response = await ingest(request, topic.id, {
      batchKey: `live-${uniqueSuffix()}`,
      agent: "e2e-agent",
      cards: [{ type: "finding", title }],
    });
    expect(response.ok()).toBe(true);
    await expect(rows.filter({ hasText: title })).toHaveCount(1);
    await expect(rows).toHaveCount(39);
  });
});

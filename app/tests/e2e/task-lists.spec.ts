import { expect, test, type Page } from "@playwright/test";
import { ensureAuthed } from "./helpers/auth";

const rowByText = (page: Page, text: string) =>
  page.locator("[data-testid^='task-row-']").filter({ hasText: text }).first();

test.describe("task lists", () => {
  test.describe.configure({ mode: "serial" });

  test("create/edit/delete lists and tasks with hierarchy drag-drop", async ({ page }) => {
    test.setTimeout(120_000);

    const suffix = Date.now().toString().slice(-6);
    const listName = `E2E Tasks ${suffix}`;
    const renamedListName = `E2E Tasks Renamed ${suffix}`;
    const rootA = `Root A ${suffix}`;
    const rootB = `Root B ${suffix}`;
    const childA = `Child A ${suffix}`;

    await ensureAuthed(page);
    await page.goto("/tasks");
    await expect(page.getByTestId("tasks-page")).toBeVisible();

    await page.getByTestId("task-list-create-button").click();
    await page.getByTestId("task-list-name-input").fill(listName);
    await page.getByRole("button", { name: /^save$/i }).click();

    const listItem = page.locator("[data-testid^='task-list-item-']").filter({ hasText: listName });
    await expect(listItem).toBeVisible();

    await listItem.getByText(listName).click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type(renamedListName);
    await page.keyboard.press("Enter");
    await expect(
      page.locator("[data-testid^='task-list-item-']").filter({ hasText: renamedListName })
    ).toBeVisible();
    await page
      .locator("[data-testid^='task-list-item-']")
      .filter({ hasText: renamedListName })
      .getByText(renamedListName)
      .click();

    await page.getByTestId("task-create-button").click();
    await page.locator("[data-testid='task-edit-dialog'] textarea").first().fill(rootA);
    await page.getByTestId("task-save-button").click();
    await expect(rowByText(page, rootA)).toBeVisible();

    await page.getByTestId("task-create-button").click();
    await page.locator("[data-testid='task-edit-dialog'] textarea").first().fill(rootB);
    await page.getByTestId("task-save-button").click();
    await expect(rowByText(page, rootB)).toBeVisible();

    await page.getByTestId("task-create-button").click();
    await page.locator("[data-testid='task-edit-dialog'] textarea").first().fill(childA);
    await page.getByTestId("task-parent-select").selectOption({ label: rootA });
    await page.getByTestId("task-save-button").click();
    await expect(rowByText(page, childA)).toBeVisible();

    await rowByText(page, rootB).click();
    await page.getByTestId("task-status-select").selectOption("started");
    await page.getByTestId("task-due-date-input").fill("2026-04-15");
    await page.getByTestId("task-duration-input").fill("90");
    await page.getByTestId("task-tags-input").fill("focus, project-x");
    await page.getByTestId("task-meta-input").fill("owner: qa\npriority: p1");
    await page.getByTestId("task-save-button").click();
    await expect(rowByText(page, rootB)).toContainText("started");
    await expect(rowByText(page, rootB)).toContainText("2026-04-15");
    await expect(rowByText(page, rootB)).toContainText("90m");

    const rootARow = rowByText(page, rootA);
    await rootARow.getByRole("button", { name: /collapse task/i }).click();
    await expect(rowByText(page, childA)).toHaveCount(0);
    await rootARow.getByRole("button", { name: /expand task/i }).click();
    await expect(rowByText(page, childA)).toBeVisible();

    await page.reload();
    await expect(rowByText(page, rootA)).toBeVisible();
    await expect(rowByText(page, rootB)).toBeVisible();
    await expect(rowByText(page, childA)).toBeVisible();

    await rowByText(page, rootA).click();
    await page.getByTestId("task-delete-button").click();
    await expect(rowByText(page, rootA)).toHaveCount(0);
    await expect(rowByText(page, childA)).toBeVisible();

    const reparentedChild = rowByText(page, childA);
    const childMarginLeft = await reparentedChild.evaluate((node) =>
      window.getComputedStyle(node as HTMLElement).marginLeft
    );
    expect(parseFloat(childMarginLeft)).toBe(0);

    const renamedList = page
      .locator("[data-testid^='task-list-item-']")
      .filter({ hasText: renamedListName });
    await renamedList.getByRole("button", { name: new RegExp(`delete list ${renamedListName}`, "i") }).click();
    await expect(renamedList).toHaveCount(0);
  });
});

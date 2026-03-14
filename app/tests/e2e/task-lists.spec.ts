import { expect, test, type Page } from "@playwright/test";
import { ensureAuthed } from "./helpers/auth";

const rowByText = (page: Page, text: string) =>
  page.locator("[data-testid^='task-row-']").filter({ hasText: text }).first();

const inlineCreateInput = (page: Page) =>
  page.getByTestId("task-inline-create-row").locator("input");

const escapeForRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const detailsButtonForTask = (page: Page, text: string) =>
  rowByText(page, text).getByRole("button", {
    name: new RegExp(`edit details for ${escapeForRegex(text)}`, "i"),
  });

test.describe("task lists", () => {
  test.describe.configure({ mode: "serial" });

  test("inline task title editing preserves native left/right cursor movement and selection", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const suffix = Date.now().toString().slice(-6);
    const listName = `E2E Caret ${suffix}`;
    const taskName = `Alpha Beta ${suffix}`;

    await ensureAuthed(page);
    await page.goto("/tasks");
    await expect(page.getByTestId("tasks-page")).toBeVisible();

    await page.getByTestId("task-list-create-button").click();
    await page.getByTestId("task-list-name-input").fill(listName);
    await page.getByRole("button", { name: /^save$/i }).click();

    const listItem = page.locator("[data-testid^='task-list-item-']").filter({ hasText: listName });
    await expect(listItem).toBeVisible();
    await listItem.getByText(listName).click();

    await page.getByTestId("task-create-button").click();
    await inlineCreateInput(page).fill(taskName);
    await inlineCreateInput(page).press("Enter");
    await page.keyboard.press("Escape");

    const taskText = rowByText(page, taskName).getByText(taskName);
    await taskText.click();

    const input = page.locator("[data-testid^='task-inline-input-']").first();
    await expect(input).toBeVisible();

    await input.evaluate((el: HTMLInputElement) => el.setSelectionRange(5, 5));
    await page.keyboard.press("ArrowLeft");
    await expect
      .poll(() =>
        input.evaluate((el: HTMLInputElement) => ({
          start: el.selectionStart,
          end: el.selectionEnd,
        }))
      )
      .toEqual({ start: 4, end: 4 });

    await input.evaluate((el: HTMLInputElement) => el.setSelectionRange(5, 5));
    await page.keyboard.press("Shift+ArrowLeft");
    await expect
      .poll(() =>
        input.evaluate((el: HTMLInputElement) => ({
          start: el.selectionStart,
          end: el.selectionEnd,
        }))
      )
      .toEqual({ start: 4, end: 5 });

  });

  test("create/edit/delete lists and tasks with inline task editing and keyboard hierarchy moves", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const suffix = Date.now().toString().slice(-6);
    const listName = `E2E Tasks ${suffix}`;
    const renamedListName = `E2E Tasks Renamed ${suffix}`;
    const rootA = `Root A ${suffix}`;
    const rootARenamed = `Root A Updated ${suffix}`;
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
    await inlineCreateInput(page).fill(rootA);
    await inlineCreateInput(page).press("Enter");
    await page.keyboard.press("Escape");
    await expect(rowByText(page, rootA)).toBeVisible();

    await page.keyboard.press("n");
    await inlineCreateInput(page).fill(rootB);
    await inlineCreateInput(page).press("Enter");
    await page.keyboard.press("Escape");
    await expect(rowByText(page, rootB)).toBeVisible();

    await page.keyboard.press("n");
    await inlineCreateInput(page).fill(childA);
    await inlineCreateInput(page).press("Enter");
    await page.keyboard.press("Escape");
    await expect(rowByText(page, childA)).toBeVisible();

    await rowByText(page, childA).focus();
    await rowByText(page, childA).press("Alt+ArrowUp");
    await rowByText(page, childA).press("Alt+ArrowRight");
    await expect(rowByText(page, rootB)).toContainText("1 child");

    await rowByText(page, rootA).getByText(rootA).click();
    await page.locator("[data-testid^='task-inline-input-']").fill(`${rootARenamed} #planning`);
    await page.keyboard.press("Enter");
    await expect(rowByText(page, rootARenamed)).toContainText("#planning");

    await detailsButtonForTask(page, rootB).click();
    await page.getByTestId("task-status-select").selectOption("started");
    await page.getByTestId("task-due-date-input").fill("2026-04-15");
    await page.getByTestId("task-duration-input").fill("90");
    await page.getByTestId("task-tags-input").fill("focus, project-x");
    await page.getByTestId("task-meta-input").fill("owner: qa\npriority: p1");
    await page.getByTestId("task-save-button").click();
    await expect(rowByText(page, rootB)).toContainText("started");
    await expect(rowByText(page, rootB)).toContainText("2026-04-15");
    await expect(rowByText(page, rootB)).toContainText("90m");

    const rootBRow = rowByText(page, rootB);
    await rootBRow.getByRole("button", { name: /collapse task/i }).click();
    await expect(rowByText(page, childA)).toHaveCount(0);
    await rootBRow.getByRole("button", { name: /expand task/i }).click();
    await expect(rowByText(page, childA)).toBeVisible();

    await page.reload();
    await expect(rowByText(page, rootARenamed)).toBeVisible();
    await expect(rowByText(page, rootB)).toBeVisible();
    await expect(rowByText(page, childA)).toBeVisible();

    await detailsButtonForTask(page, rootB).click();
    await page.getByTestId("task-delete-button").click();
    await expect(rowByText(page, rootB)).toHaveCount(0);
    await expect(rowByText(page, childA)).toBeVisible();

    const renamedList = page
      .locator("[data-testid^='task-list-item-']")
      .filter({ hasText: renamedListName });
    await renamedList
      .getByRole("button", { name: new RegExp(`delete list ${escapeForRegex(renamedListName)}`, "i") })
      .click();
    await expect(renamedList).toHaveCount(0);
  });
});

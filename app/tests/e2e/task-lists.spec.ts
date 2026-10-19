import { expect, test, type Page } from "@playwright/test";
import { ensureAuthed } from "./helpers/auth";
import { waitForAppReady } from "./helpers/readiness";

const rowByText = (page: Page, text: string) =>
  page.locator("[data-testid^='task-row-']").filter({ hasText: text }).first();

const rowTitles = (page: Page) =>
  page.locator("[data-testid^='task-row-']").allInnerTexts();

const listsNav = (page: Page) =>
  page.getByRole("navigation", { name: "Task lists" });

const listItem = (page: Page, name: string) =>
  page.locator("[data-testid^='task-list-item-']").filter({ hasText: name });

const quickAdd = (page: Page) => page.getByTestId("task-quick-add-input");

/** Creates a list from the sidebar; a new list is selected straight away. */
const createList = async (page: Page, name: string) => {
  await listsNav(page).getByRole("button", { name: "New list" }).click();
  const input = listsNav(page).getByLabel("New list name");
  await input.fill(name);
  await input.press("Enter");
  await expect(listItem(page, name)).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("task-list-title")).toHaveText(name);
};

const addTask = async (page: Page, title: string) => {
  await quickAdd(page).fill(title);
  await quickAdd(page).press("Enter");
  await expect(rowByText(page, title)).toBeVisible();
  await expect(quickAdd(page)).toHaveValue("");
};

/** Retries the menu: a row refresh after a save can close it again. */
const openRowMenuItem = async (page: Page, task: string, item: string) => {
  const menuItem = page.getByRole("menuitem", { name: item });
  await expect(async () => {
    if (!(await menuItem.isVisible())) {
      await rowByText(page, task)
        .getByRole("button", { name: `Actions for ${task}` })
        .click();
    }
    await menuItem.click({ timeout: 2_000 });
  }).toPass();
};

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
    await waitForAppReady(page);
    await expect(page.getByTestId("tasks-page")).toBeVisible();

    await createList(page, listName);
    await addTask(page, taskName);

    await rowByText(page, taskName).getByText(taskName).click();

    const input = page.locator("[data-testid^='task-inline-input-']").first();
    await expect(input).toBeVisible();

    await input.evaluate((el: HTMLInputElement) => el.setSelectionRange(5, 5));
    await page.keyboard.press("ArrowLeft");
    await expect
      .poll(() =>
        input.evaluate((el: HTMLInputElement) => ({
          start: el.selectionStart,
          end: el.selectionEnd,
        })),
      )
      .toEqual({ start: 4, end: 4 });

    await input.evaluate((el: HTMLInputElement) => el.setSelectionRange(5, 5));
    await page.keyboard.press("Shift+ArrowLeft");
    await expect
      .poll(() =>
        input.evaluate((el: HTMLInputElement) => ({
          start: el.selectionStart,
          end: el.selectionEnd,
        })),
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
    await waitForAppReady(page);
    await expect(page.getByTestId("tasks-page")).toBeVisible();

    await createList(page, listName);

    await listItem(page, listName).dblclick();
    const renameInput = listsNav(page).getByLabel(`Rename ${listName}`);
    await renameInput.fill(renamedListName);
    await renameInput.press("Enter");
    await expect(listItem(page, renamedListName)).toBeVisible();
    await expect(page.getByTestId("task-list-title")).toHaveText(
      renamedListName,
    );

    // Wrapped names keep their height when the list column scrolls.
    const clippedLists = await page
      .locator("[data-testid^='task-list-item-']")
      .evaluateAll(
        (nodes) =>
          nodes.filter((node) => node.scrollHeight > node.clientHeight + 1)
            .length,
      );
    expect(clippedLists).toBe(0);

    await addTask(page, rootA);
    await addTask(page, rootB);
    await quickAdd(page).press("Escape");

    // "n" opens a draft row below the active task.
    await rowByText(page, rootB).focus();
    await rowByText(page, rootB).press("n");
    const draft = page.getByLabel("New task title");
    await draft.fill(childA);
    await draft.press("Enter");
    await expect(rowByText(page, childA)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(draft).toHaveCount(0);
    expect(await rowTitles(page)).toEqual([
      expect.stringContaining(rootA),
      expect.stringContaining(rootB),
      expect.stringContaining(childA),
    ]);

    await rowByText(page, childA).focus();
    await rowByText(page, childA).press("Alt+ArrowUp");
    await expect
      .poll(() => rowTitles(page))
      .toEqual([
        expect.stringContaining(rootA),
        expect.stringContaining(childA),
        expect.stringContaining(rootB),
      ]);
    // No wait here: a refetch from the first move must not revert the
    // second before the indent reads the order.
    await rowByText(page, childA).press("Alt+ArrowDown");
    await rowByText(page, childA).press("Alt+ArrowRight");
    await expect(rowByText(page, rootB)).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(rowByText(page, rootB)).toContainText("0/1");

    await rowByText(page, rootA).getByText(rootA).click();
    await page
      .locator("[data-testid^='task-inline-input-']")
      .fill(`${rootARenamed} #planning`);
    await page.keyboard.press("Enter");
    await expect(rowByText(page, rootARenamed)).toContainText("#planning");
    await expect(
      page.locator("[data-testid^='task-inline-input-']"),
    ).toHaveCount(0);

    await openRowMenuItem(page, rootB, "Edit details");
    const dialog = page.getByTestId("task-edit-dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "In progress" }).click();
    await page.getByTestId("task-due-date-input").fill("2026-04-15");
    await page.getByTestId("task-duration-input").fill("90");
    await dialog.getByRole("button", { name: "Advanced details" }).click();
    await page.getByTestId("task-tags-input").fill("focus, project-x");
    await page.getByTestId("task-meta-input").fill("owner: qa\npriority: p1");
    await page.getByTestId("task-save-button").click();
    await expect(dialog).toBeHidden();

    const rootBRow = rowByText(page, rootB);
    await expect(
      rootBRow.locator("[data-testid^='task-status-']"),
    ).toHaveAttribute("data-status", "started");
    await expect(
      rootBRow.locator("[data-testid^='task-due-']"),
    ).toHaveAttribute("title", /Apr 15/);
    await expect(rootBRow).toContainText("1h 30m");
    await expect(rootBRow).toContainText("#focus");
    await expect(rootBRow).toContainText("#project-x");

    await rootBRow.getByRole("button", { name: "Collapse subtasks" }).click();
    await expect(rowByText(page, childA)).toHaveCount(0);
    await rootBRow.getByRole("button", { name: "Expand subtasks" }).click();
    await expect(rowByText(page, childA)).toBeVisible();

    // Expansion is per-visit, so subtasks start collapsed after a reload.
    await page.reload();
    await expect(rowByText(page, rootARenamed)).toBeVisible();
    await expect(rowByText(page, rootB)).toContainText("0/1");
    await rowByText(page, rootB)
      .getByRole("button", { name: "Expand subtasks" })
      .click();
    await expect(rowByText(page, childA)).toBeVisible();

    await openRowMenuItem(page, rootB, "Edit details");
    await page.getByTestId("task-delete-button").click();
    await expect(rowByText(page, rootB)).toHaveCount(0);
    await expect(rowByText(page, childA)).toBeVisible();

    await listItem(page, renamedListName)
      .getByRole("button", { name: `Actions for list ${renamedListName}` })
      .click();
    await page.getByRole("menuitem", { name: "Delete list" }).click();
    await page
      .getByRole("alertdialog")
      .or(page.getByRole("dialog"))
      .getByRole("button", { name: "Delete list" })
      .click();
    await expect(listItem(page, renamedListName)).toHaveCount(0);
  });
});

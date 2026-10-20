import { expect, type Page } from "@playwright/test";

export const pathInput = (page: Page) =>
  page.getByPlaceholder("e.g. work.projects.alpha");

export const pathPopover = (page: Page) =>
  page
    .locator('[data-scope="popover"][data-part="content"]')
    .filter({ has: pathInput(page) });

export const savePathButton = (page: Page) =>
  pathPopover(page).getByRole("button", { name: "Save", exact: true });

export const pathHint = (page: Page) =>
  page.getByText("Pick a child to continue nesting, or type a segment and hit");

const openPathPopover = (page: Page) =>
  pathPopover(page).and(page.locator('[data-state="open"]'));

/**
 * The note header's path chip: "Set path" when unfiled, else "Edit path".
 * Checks `data-state` rather than visibility: a popover dismissed with Escape
 * stays visible through its exit animation and then detaches.
 */
export const openPathEditor = async (page: Page) => {
  if (await openPathPopover(page).isVisible()) return;
  await page.getByRole("button", { name: /^(Set path|Edit path)$/ }).click();
  await expect(openPathPopover(page)).toBeVisible();
  await expect(pathInput(page)).toBeVisible();
};

/** The breadcrumb's last link points at the note's full path. */
export const expectNotePath = async (page: Page, path: string) => {
  await expect(
    page
      .getByRole("navigation", { name: "Note path" })
      .getByRole("link")
      .last(),
  ).toHaveAttribute("href", `/path/${path.split(".").join("/")}`);
};

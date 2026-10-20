import { expect, type Page } from "@playwright/test";

/** Header control that opens the path editor when the note has no path. */
export const setPathButton = (page: Page) =>
  page.getByRole("button", { name: "Set path", exact: true });

/** Header control that opens the path editor when the note has a path. */
export const editPathButton = (page: Page) =>
  page.getByRole("button", { name: "Edit path", exact: true });

/**
 * The header shows a note's path as breadcrumb links, one per ancestor, and
 * the last crumb's title is the full path. Asserting on it proves the header
 * shows exactly `path`, not just a path that ends in the same segment.
 */
export const expectNotePath = async (page: Page, path: string) => {
  const crumbs = page
    .getByRole("navigation", { name: "Note path", exact: true })
    .getByRole("link");
  await expect(crumbs.last()).toHaveAttribute("title", path);
  await expect(crumbs).toHaveCount(path.split(".").length);
};

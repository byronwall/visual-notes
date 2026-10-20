import { expect, test, type Page } from "@playwright/test";
import { createNoteFixture, uniqueSuffix } from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";

// Loads every top-level page and fails on any page error, hydration warning,
// or the global error overlay. CI runs this file against `pnpm dev` as well
// as the production build: the note-title crash (#125) and the mobile
// "mismatched transaction" crash only showed in dev builds.
const routes = [
  "/",
  "/docs/new",
  "/tasks",
  "/time-blocks",
  "/archive",
  "/canvas",
  "/paths",
  "/path",
  "/tags",
  "/activity",
  "/views/note-tasks",
  "/umap",
  "/embeddings",
  "/ai",
  "/visual",
  "/admin",
  "/admin/migrations",
  "/admin/connections",
];

const watchForErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat/i.test(message.text())) {
      errors.push(`console: ${message.text()}`);
    }
  });
  return errors;
};

const expectCleanLoad = async (page: Page, path: string) => {
  const errors = watchForErrors(page);
  await page.goto(path);
  await waitForAppReady(page);
  // Hydration errors can surface a tick after the ready marker.
  await page.waitForTimeout(300);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(errors, `${path} should load without errors`).toEqual([]);
};

for (const path of routes) {
  test(`${path} hydrates without errors`, async ({ page }) => {
    await expectCleanLoad(page, path);
  });
}

test("a note whose title differs from its first heading hydrates", async ({
  page,
}) => {
  const id = await createNoteFixture(page, {
    title: `Smoke title ${uniqueSuffix()}`,
    markdown: "# A different first heading\n\nBody text.",
  });
  await expectCleanLoad(page, `/docs/${id}`);
});

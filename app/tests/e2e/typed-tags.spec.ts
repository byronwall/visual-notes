import { expect, test } from "@playwright/test";
import { createNoteFixture, uniqueSuffix } from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";

// Tags hold note content together, so type them the way a person does: with
// real keys, no menu pick, and a reload before reading the index.
test("a typed tag becomes a real tag and survives a reload", async ({
  page,
}) => {
  const suffix = uniqueSuffix();
  const spaced = `spaced${suffix}`;
  const entered = `entered${suffix}`;
  const title = `Typed tags ${suffix}`;
  const noteId = await createNoteFixture(page, {
    title,
    markdown: `# ${title}\n\nBody line.`,
  });

  await page.goto(`/docs/${noteId}`);
  await waitForAppReady(page);
  const editor = page.locator(".ProseMirror");
  await editor.getByText("Body line.").click();
  await page.keyboard.press("End");
  await page.keyboard.type(` A line with #${spaced} and PR #42`, { delay: 40 });
  await page.keyboard.press("Enter");
  await page.keyboard.type(`#${entered}`, { delay: 40 });
  await page.keyboard.press("Enter");
  await page.keyboard.type("Last line.", { delay: 40 });

  const tags = editor.locator(".note-tag");
  await expect(tags).toHaveText([`#${spaced}`, `#${entered}`]);
  await expect(editor).toContainText("PR #42");
  await expect(page.getByText(/^Saved/).first()).toBeVisible();

  await page.reload();
  await waitForAppReady(page);
  await expect(tags).toHaveText([`#${spaced}`, `#${entered}`]);

  await page.goto(`/tags/${spaced}`);
  await waitForAppReady(page);
  await expect(page.getByText(/^1 block\b/)).toBeVisible();
});

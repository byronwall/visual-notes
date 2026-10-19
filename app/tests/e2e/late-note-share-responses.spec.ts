import { expect, test, type Page } from "@playwright/test";
import { createNoteFixture, uniqueSuffix } from "./helpers/fixtures";
import { pinEditableByText } from "./helpers/editable";
import { waitForAppReady } from "./helpers/readiness";
import { holdNextServerAction, settled } from "./helpers/server-actions";

// Regressions for PR #31 (share panel) and PR #43 (note title callbacks) on the
// real /docs route, where one DocumentViewer and DocSharePanel stay mounted
// while client-side navigation swaps notes. Every case holds note A's real
// request, puts B (or a second visit to A) on screen first, and only then lets
// A's request finish.

type Note = { id: string; title: string };

const createLinkedNotes = async (
  page: Parameters<typeof createNoteFixture>[0],
  label: string,
) => {
  const suffix = uniqueSuffix();
  const path = `late-${label}-${suffix}`;
  const notes: Note[] = [];
  for (const name of ["A", "B"]) {
    const title = `Late ${label} ${name} ${suffix}`;
    const id = await createNoteFixture(page, {
      title,
      markdown: `Body of ${title}`,
      path,
    });
    notes.push({ id, title });
  }
  return { path, a: notes[0], b: notes[1] };
};

const titlePreview = (page: Page, title: string) =>
  page
    .locator('[data-scope="editable"][data-part="preview"]')
    .filter({ hasText: title });

const expectNoteInPlace = async (page: Page, note: Note) => {
  await expect(page).toHaveURL(new RegExp(`/docs/${note.id}$`));
  await expect(titlePreview(page, note.title)).toBeVisible();
};

/** Client-side A→B through the path's related-notes list. */
const openRelatedNote = async (page: Page, note: Note) => {
  await page
    .getByRole("button", { name: "Related notes in this path" })
    .click();
  await page.getByRole("button", { name: note.title }).click();
  await expectNoteInPlace(page, note);
};

/** Client-side B→A: a new visit to A in the same mounted viewer. */
const returnToNote = async (page: Page, note: Note) => {
  await page.goBack();
  await expectNoteInPlace(page, note);
};

const unsharedLabel = "Create a share link";
const shareButton = (page: Page) =>
  page.getByRole("button", {
    name: /^(Create a share link|Manage shared note link)$/,
  });
const sharePopover = (page: Page) =>
  page
    .locator('[data-scope="popover"][data-part="content"]')
    .filter({ hasText: "Public share" });
const slugInput = (page: Page) =>
  sharePopover(page).getByPlaceholder("defaults to generated id");

/** Retries the toggle: a note that is still loading can close it again. */
const openSharePopover = async (page: Page) => {
  await expect(async () => {
    if (!(await sharePopover(page).isVisible())) {
      await shareButton(page).click();
    }
    await expect(sharePopover(page)).toBeVisible({ timeout: 2_000 });
  }).toPass();
};

test.describe("late share responses", () => {
  test("A's share result does not land on B (A→B)", async ({ page }) => {
    const { a, b } = await createLinkedNotes(page, "share");
    await page.goto(`/docs/${a.id}`);
    await waitForAppReady(page);

    await openSharePopover(page);
    const create = await holdNextServerAction(page, "upsertDocShare", [a.id]);
    await sharePopover(page).getByRole("button", { name: "Create" }).click();
    await create.request;
    await page.keyboard.press("Escape");

    await openRelatedNote(page, b);
    await expect(shareButton(page)).toHaveAccessibleName(unsharedLabel);

    create.release();
    await settled(create);
    await expect(shareButton(page)).toHaveAccessibleName(unsharedLabel);
  });

  test("an old visit's share result keeps the new visit's draft (A→B→A)", async ({
    page,
  }) => {
    const { a, b } = await createLinkedNotes(page, "share-return");
    const suffix = uniqueSuffix();
    await page.goto(`/docs/${a.id}`);
    await waitForAppReady(page);

    await openSharePopover(page);
    await slugInput(page).fill(`first-visit-${suffix}`);
    const create = await holdNextServerAction(page, "upsertDocShare", [a.id]);
    await sharePopover(page).getByRole("button", { name: "Create" }).click();
    await create.request;
    await page.keyboard.press("Escape");

    await openRelatedNote(page, b);
    await returnToNote(page, a);

    await openSharePopover(page);
    const newerDraft = `second-visit-${suffix}`;
    await slugInput(page).fill(newerDraft);

    create.release();
    await settled(create);
    await expect(slugInput(page)).toHaveValue(newerDraft);
    await expect(
      sharePopover(page).getByRole("button", { name: "Create" }),
    ).toBeEnabled();
  });
});

test.describe("late note title responses", () => {
  test("A's failed title save does not roll B's title back (A→B)", async ({
    page,
  }) => {
    const { a, b } = await createLinkedNotes(page, "title");
    await page.goto(`/docs/${a.id}`);
    await waitForAppReady(page);

    const titleA = await pinEditableByText(page, a.title);
    await titleA.preview.click();
    await titleA.input.fill(`${a.title} edited`);
    const save = await holdNextServerAction(page, "updateDoc", [a.id]);
    await titleA.input.press("Enter");
    await save.request;

    await openRelatedNote(page, b);

    save.fail();
    await settled(save);
    await expect(titlePreview(page, b.title)).toBeVisible();
    await expect(titlePreview(page, a.title)).toHaveCount(0);
    await expect(page).toHaveTitle(`${b.title} • Visual Notes`);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("an old visit's failed title save keeps the newer title (A→B→A)", async ({
    page,
  }) => {
    const { a, b } = await createLinkedNotes(page, "title-return");
    await page.goto(`/docs/${a.id}`);
    await waitForAppReady(page);

    const firstVisit = await pinEditableByText(page, a.title);
    await firstVisit.preview.click();
    await firstVisit.input.fill(`${a.title} first visit`);
    const staleSave = await holdNextServerAction(page, "updateDoc", [a.id]);
    await firstVisit.input.press("Enter");
    await staleSave.request;

    await openRelatedNote(page, b);
    await returnToNote(page, a);

    // A real, successful save from the second visit.
    const newerTitle = `${a.title} second visit`;
    const secondVisit = await pinEditableByText(page, a.title);
    await secondVisit.preview.click();
    await secondVisit.input.fill(newerTitle);
    const newerSave = await holdNextServerAction(page, "updateDoc", [
      a.id,
      newerTitle,
    ]);
    await secondVisit.input.press("Enter");
    newerSave.release();
    await settled(newerSave);
    await expect(secondVisit.preview).toHaveText(newerTitle);

    staleSave.fail();
    await settled(staleSave);
    await expect(secondVisit.preview).toHaveText(newerTitle);
    await expect(page).toHaveTitle(`${newerTitle} • Visual Notes`);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});

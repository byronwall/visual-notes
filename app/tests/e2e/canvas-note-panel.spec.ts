import { expect, test, type Page } from "@playwright/test";
import {
  canSeedAuditDatabase,
  createNoteFixture,
  seedCanvasRegionFixture,
  uniqueSuffix,
} from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";
import { holdNextServerAction, settled } from "./helpers/server-actions";

// Regressions on the real /canvas route and its keyed note panel.
// PR #44: closing the panel (close button, backdrop, or Escape) used to drop
// unsaved edits and could close mid-save; Escape inside the guard dialog must
// not close the panel.
// PR #43: a disposed panel viewer must not report its late failure over the
// note that replaced it.
//
// Canvas only lists notes inside a UMAP region, so each test seeds a one-region
// projection into the audit database. Without an audit run (or in CI, which has
// no app server) the file is skipped rather than writing to another database.

const panel = (page: Page) =>
  page.getByRole("dialog", { name: "Document details" });
const editor = (page: Page) => panel(page).locator(".ProseMirror");
const discardDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Discard unsaved changes?" });
const savingDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Note is saving" });

const openFromRail = async (page: Page, title: string) => {
  await page.getByRole("button", { name: title, exact: true }).first().click();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page)).toContainText(title);
  await expect(editor(page)).toContainText("Body of ");
  // The editor loads its own copy of the note; wait until it can save so
  // typing does not race that load.
  await expect(
    panel(page).getByRole("button", { name: "Save note", exact: true }),
  ).toBeEnabled();
  await page.waitForLoadState("networkidle");
};

const typeIntoEditor = async (page: Page, text: string) => {
  await editor(page).click();
  await expect(editor(page)).toBeFocused();
  await page.keyboard.type(text);
  await expect(editor(page)).toContainText(text);
  // The panel's save control reports the editor as dirty.
  await expect(
    panel(page).getByRole("button", { name: "Save note changes" }),
  ).toBeVisible();
};

const clickBackdrop = (page: Page) =>
  panel(page).click({ position: { x: 10, y: 200 } });

test.describe("canvas note panel", () => {
  // The canvas reads the newest UMAP run, so these tests run one at a time in
  // one worker; "default" (unlike "serial") still runs the rest after a failure.
  test.describe.configure({ mode: "default" });
  test.skip(
    !canSeedAuditDatabase(),
    "needs AUDIT_RUN_MANIFEST and AUDIT_ENV_FILE to seed a canvas region",
  );

  let title: string;
  let noteId: string;
  let otherTitle: string;

  test.beforeEach(async ({ page }) => {
    const suffix = uniqueSuffix();
    title = `Canvas guard ${suffix}`;
    otherTitle = `Canvas guard other ${suffix}`;
    noteId = await createNoteFixture(page, {
      title,
      markdown: `Body of ${title}`,
    });
    const otherId = await createNoteFixture(page, {
      title: otherTitle,
      markdown: `Body of ${otherTitle}`,
    });
    const regionTitle = `Canvas region ${suffix}`;
    await seedCanvasRegionFixture(regionTitle, [
      { id: noteId, title },
      { id: otherId, title: otherTitle },
    ]);
    await page.goto("/canvas");
    await waitForAppReady(page);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: regionTitle }).click();
  });

  test("unsaved edits ask before the panel closes", async ({ page }) => {
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/_server")) {
        if ((request.postData() ?? "").includes("unsaved canvas edit")) {
          posts.push(request.url());
        }
      }
    });

    await openFromRail(page, title);
    await typeIntoEditor(page, " unsaved canvas edit");

    await panel(page).getByRole("button", { name: "Close panel" }).click();
    await expect(discardDialog(page)).toBeVisible();
    await discardDialog(page)
      .getByRole("button", { name: "Keep editing" })
      .click();
    await expect(discardDialog(page)).toBeHidden();
    await expect(editor(page)).toContainText("unsaved canvas edit");

    // Escape on the panel is guarded; Escape in the guard dialog only
    // dismisses that dialog. (The editor keeps Escape for itself.)
    await panel(page).getByRole("button", { name: "Close panel" }).focus();
    await page.keyboard.press("Escape");
    await expect(discardDialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(discardDialog(page)).toBeHidden();
    await expect(panel(page)).toBeVisible();
    await expect(editor(page)).toContainText("unsaved canvas edit");

    await clickBackdrop(page);
    await expect(discardDialog(page)).toBeVisible();
    await discardDialog(page)
      .getByRole("button", { name: "Discard changes" })
      .click();
    await expect(panel(page)).toBeHidden();

    await openFromRail(page, title);
    await expect(editor(page)).not.toContainText("unsaved canvas edit");
    expect(posts, "discarding must not save the edit").toEqual([]);
  });

  test("a save in flight blocks closing until it finishes", async ({
    page,
  }) => {
    await openFromRail(page, title);
    await typeIntoEditor(page, " saved canvas edit");

    const save = await holdNextServerAction(page, "updateDoc", [noteId]);
    await panel(page)
      .getByRole("button", { name: "Save note changes" })
      .click();
    await save.request;

    await panel(page).getByRole("button", { name: "Close panel" }).click();
    await expect(savingDialog(page)).toBeVisible();
    await savingDialog(page)
      .getByRole("button", { name: "Keep editing" })
      .click();
    await expect(savingDialog(page)).toBeHidden();
    await expect(panel(page)).toBeVisible();

    await clickBackdrop(page);
    await expect(savingDialog(page)).toBeVisible();

    save.release();
    await settled(save);
    // The dialog closes itself once the save completes.
    await expect(savingDialog(page)).toBeHidden();
    await expect(panel(page)).toBeVisible();

    await panel(page).getByRole("button", { name: "Close panel" }).click();
    await expect(discardDialog(page)).toBeHidden();
    await expect(panel(page)).toBeHidden();

    await openFromRail(page, title);
    await expect(editor(page)).toContainText("saved canvas edit");
  });

  test("a closed note's late delete failure stays quiet over the next note", async ({
    page,
  }) => {
    const nativeDialogs: string[] = [];
    page.on("dialog", (dialog) => {
      nativeDialogs.push(dialog.message());
      void dialog.dismiss();
    });

    await openFromRail(page, title);
    await panel(page).getByRole("button", { name: "Delete note" }).click();
    const confirm = page.getByRole("dialog", { name: "Delete this note?" });
    await expect(confirm).toBeVisible();
    const remove = await holdNextServerAction(page, "deleteDoc", [noteId]);
    await confirm.getByRole("button", { name: "Delete note" }).click();
    await remove.request;

    // Dispose A's viewer and put B's viewer in place before A's delete fails.
    await panel(page).getByRole("button", { name: "Close panel" }).click();
    await expect(panel(page)).toBeHidden();
    await openFromRail(page, otherTitle);

    remove.fail();
    await settled(remove);
    await expect(panel(page)).toContainText(otherTitle);
    expect(nativeDialogs, "A's failure must not alert over B").toEqual([]);
  });
});

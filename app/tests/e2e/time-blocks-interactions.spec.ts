import { expect, test, type Locator, type Page } from "@playwright/test";
import { ensureAuthed } from "./helpers/auth";
import { uniqueSuffix } from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";

const getBox = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Expected element bounding box");
  return box;
};

/** The block's top inside the grid, which ignores scroller auto-scroll. */
const gridTop = (block: Locator) =>
  block.evaluate((node) => parseFloat((node as HTMLElement).style.top));

/**
 * The block's day column from its `left`. Browsers fold the sub-lane offset
 * into one percentage when they simplify the calc(), so floor it.
 */
const dayOf = (block: Locator) =>
  block.evaluate((node) => {
    const match = (node as HTMLElement).style.left.match(/([\d.]+)%/);
    return match ? Math.floor(parseFloat(match[1]) / (100 / 7) + 1e-6) : -1;
  });

const openCalendar = async (page: Page) => {
  await ensureAuthed(page);
  await page.goto("/time-blocks");
  await waitForAppReady(page);
  await expect(page.getByTestId("time-blocks-grid")).toBeVisible();
};

/**
 * Finds an on-screen point with `span` px of empty grid below it, trying the
 * preferred day column (0-based) first. Blocks from earlier runs or retries
 * share the database, so fixed coordinates could land on one and move it.
 */
const emptySlot = async (page: Page, preferredDay: number, span = 200) => {
  const point = await page.evaluate(
    ({ preferredDay, span }) => {
      const grid = document.querySelector<HTMLElement>(
        "[data-testid=time-blocks-grid]",
      );
      const scroller = document.querySelector<HTMLElement>(
        "[data-testid=time-blocks-scroller]",
      );
      const header = document.querySelector<HTMLElement>(
        "[data-testid=time-blocks-day-header]",
      );
      if (!grid || !scroller) return null;
      const search = (dayIndex: number) => {
        const gridRect = grid.getBoundingClientRect();
        const visible = scroller.getBoundingClientRect();
        const top = Math.max(
          gridRect.top,
          visible.top,
          header?.getBoundingClientRect().bottom ?? 0,
        );
        const bottom = Math.min(gridRect.bottom, visible.bottom, innerHeight);
        const x = gridRect.left + (gridRect.width / 7) * (dayIndex + 0.5);
        const isEmpty = (y: number) => document.elementFromPoint(x, y) === grid;
        for (let y = top + 20; y + span < bottom; y += 10) {
          let clear = true;
          for (let dy = 0; dy <= span && clear; dy += 5) {
            clear = isEmpty(y + dy);
          }
          if (clear) return { x, y };
        }
        return null;
      };
      // Scroll the day from the top until a free stretch is on screen.
      const maxScroll = scroller.scrollHeight - scroller.clientHeight;
      const days = [0, 1, 2, 3, 4, 5, 6].sort(
        (a, b) => Math.abs(a - preferredDay) - Math.abs(b - preferredDay),
      );
      for (const day of days) {
        for (let offset = 0; offset <= maxScroll + 100; offset += 100) {
          scroller.scrollTop = Math.min(offset, maxScroll);
          const found = search(day);
          if (found) return found;
        }
      }
      return null;
    },
    { preferredDay, span },
  );
  if (!point) throw new Error("No empty slot in this week");
  return point;
};

/** Drags out a new block in the given day column; the draft takes a title. */
const drawDraft = async (page: Page, x: number, y: number, height = 60) => {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + height, { steps: 8 });
  await expect(page.getByTestId("time-block-create-preview")).toBeVisible();
  await page.mouse.up();
  const input = page.getByTestId("time-block-draft-input");
  await expect(input).toBeFocused();
  return input;
};

const blockByTitle = (page: Page, title: string) =>
  page.getByTestId("time-block-item").filter({ hasText: title });

const createBlock = async (page: Page, x: number, y: number, title: string) => {
  const input = await drawDraft(page, x, y);
  await input.fill(title);
  await input.press("Enter");
  await expect(blockByTitle(page, title)).toBeVisible();
  await expect(page.getByTestId("time-block-draft")).toHaveCount(0);
  return blockByTitle(page, title);
};

const deleteBlock = async (page: Page, title: string) => {
  await blockByTitle(page, title).click();
  const popover = page.getByTestId("time-block-quick-popover");
  await popover.getByRole("button", { name: "Delete block" }).click();
  await page
    .getByRole("alertdialog")
    .or(page.getByRole("dialog"))
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(blockByTitle(page, title)).toHaveCount(0);
};

test.describe("time blocks interactions", () => {
  test.describe.configure({ mode: "serial" });
  test("drag create, move, and resize works with mouse", async ({ page }) => {
    test.setTimeout(90_000);
    await openCalendar(page);
    const title = `Drag block ${uniqueSuffix()}`;

    const { x: createX, y: createY } = await emptySlot(page, 6, 320);

    await page.mouse.move(createX, createY);
    await page.mouse.down();
    await page.mouse.move(createX, createY + 60, { steps: 8 });
    const createPreview = page.getByTestId("time-block-create-preview");
    await expect(createPreview).toBeVisible();
    const previewStyle = await createPreview.evaluate((node) => {
      const style = window.getComputedStyle(node as HTMLElement);
      return { opacity: Number(style.opacity), boxShadow: style.boxShadow };
    });
    expect(previewStyle.opacity).toBeGreaterThanOrEqual(0.8);
    expect(previewStyle.boxShadow).not.toBe("none");
    await page.mouse.up();

    const draftInput = page.getByTestId("time-block-draft-input");
    await expect(draftInput).toBeFocused();
    await draftInput.fill(title);
    await draftInput.press("Enter");
    const block = blockByTitle(page, title);
    await expect(block).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const beforeResize = await getBox(block);
    const resizeBottomBox = await getBox(
      block.getByTestId("time-block-resize-bottom"),
    );
    const handleX = resizeBottomBox.x + resizeBottomBox.width / 2;
    const handleY = resizeBottomBox.y + resizeBottomBox.height / 2;
    await block.getByTestId("time-block-resize-bottom").hover();
    await page.mouse.down();
    await page.mouse.move(handleX, handleY + 70, { steps: 10 });
    await expect(page.getByTestId("time-block-drag-ghost")).toBeVisible();
    await page.mouse.up();
    await expect(page.getByTestId("time-block-drag-ghost")).toHaveCount(0);
    await expect
      .poll(async () => (await getBox(block)).height)
      .toBeGreaterThan(beforeResize.height + 40);

    const beforeMove = await getBox(block);
    const topBeforeMove = await gridTop(block);
    // hover() checks that this block, not an overlapping one, gets the press.
    await block.hover({ position: { x: beforeMove.width / 2, y: 14 } });
    await page.mouse.down();
    await page.mouse.move(
      beforeMove.x + beforeMove.width / 2 + 10,
      beforeMove.y + 95,
      { steps: 12 },
    );
    await expect(page.getByTestId("time-block-drag-ghost")).toBeVisible();
    await page.mouse.up();
    await expect(page.getByTestId("time-block-drag-ghost")).toHaveCount(0);
    await expect.poll(() => gridTop(block)).toBeGreaterThan(topBeforeMove + 40);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("time-block-quick-popover")).toHaveCount(0);

    // Move it to a neighboring day. The pointer comes up off the original
    // block, so no click lands on it; the next real click must still open it.
    const gridBox = await getBox(page.getByTestId("time-blocks-grid"));
    const laneWidth = gridBox.width / 7;
    const beforeDayMove = await getBox(block);
    const fromDay = await dayOf(block);
    const fromX = beforeDayMove.x + beforeDayMove.width / 2;
    const dx = fromDay > 0 ? -laneWidth : laneWidth;
    await block.hover({ position: { x: beforeDayMove.width / 2, y: 14 } });
    await page.mouse.down();
    await page.mouse.move(fromX + dx, beforeDayMove.y + 14, { steps: 12 });
    await expect(page.getByTestId("time-block-drag-ghost")).toBeVisible();
    await page.mouse.up();
    await expect.poll(() => dayOf(block)).toBe(fromDay + (dx < 0 ? -1 : 1));

    await block.click();
    await expect(page.getByTestId("time-block-quick-popover")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("time-block-quick-popover")).toHaveCount(0);

    await deleteBlock(page, title);
  });

  test("editor dialog width is constrained", async ({ page }) => {
    await openCalendar(page);

    // Shift+Enter on a draft opens the full editor.
    const slot = await emptySlot(page, 5, 80);
    const input = await drawDraft(page, slot.x, slot.y);
    await input.press("Shift+Enter");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const dialogBox = await getBox(dialog);
    expect(dialogBox.width).toBeGreaterThanOrEqual(600);
    expect(dialogBox.width).toBeLessThanOrEqual(760);
  });

  test("blocks render inline dynamic geometry styles with distinct positions", async ({
    page,
  }) => {
    await openCalendar(page);
    const suffix = uniqueSuffix();
    const titles = [`Geometry early ${suffix}`, `Geometry late ${suffix}`];
    for (const title of titles) {
      const slot = await emptySlot(page, 4, 80);
      await createBlock(page, slot.x, slot.y, title);
    }

    const blocks = page.getByTestId("time-block-item");
    const styleSamples = await blocks.evaluateAll((nodes) =>
      nodes.slice(0, 12).map((node) => ({
        style: (node as HTMLElement).getAttribute("style") ?? "",
        top: (node as HTMLElement).style.top,
        width: (node as HTMLElement).style.width,
        height: (node as HTMLElement).style.height,
        y: Math.round((node as HTMLElement).getBoundingClientRect().y),
      })),
    );
    expect(styleSamples.length).toBeGreaterThan(1);

    for (const sample of styleSamples) {
      expect(sample.style).toContain("top:");
      expect(sample.style).toContain("left:");
      expect(sample.style).toContain("width:");
      expect(sample.style).toContain("height:");
      expect(sample.width).not.toBe("");
      expect(sample.height).not.toBe("");
    }

    expect(new Set(styleSamples.map((s) => s.top)).size).toBeGreaterThan(1);
    expect(new Set(styleSamples.map((s) => s.y)).size).toBeGreaterThan(1);

    for (const title of titles) await deleteBlock(page, title);
  });
});

import { expect, test, type Locator } from "@playwright/test";
import { ensureAuthed } from "./helpers/auth";

const getBox = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Expected element bounding box");
  return box;
};

test.describe("time blocks interactions", () => {
  test.describe.configure({ mode: "serial" });
  test("drag create, move, and resize works with mouse", async ({ page }) => {
    test.setTimeout(90_000);
    await ensureAuthed(page);
    await page.goto("/time-blocks");

    const grid = page.getByTestId("time-blocks-grid");
    await expect(grid).toBeVisible();
    const gridBox = await getBox(grid);

    const createStartX = gridBox.x + gridBox.width * 0.92;
    const createStartY = gridBox.y + 220;
    const createEndY = createStartY + 60;

    await page.mouse.move(createStartX, createStartY);
    await page.mouse.down();
    await page.mouse.move(createStartX, createEndY, { steps: 8 });
    const createPreview = page.getByTestId("time-block-create-preview");
    await expect(createPreview).toBeVisible();
    const previewStyle = await createPreview.evaluate((node) => {
      const style = window.getComputedStyle(node as HTMLElement);
      return {
        opacity: Number(style.opacity),
        borderWidth: parseFloat(style.borderTopWidth || "0"),
        boxShadow: style.boxShadow,
      };
    });
    expect(previewStyle.opacity).toBeGreaterThanOrEqual(0.8);
    expect(previewStyle.borderWidth).toBeGreaterThanOrEqual(2);
    expect(previewStyle.boxShadow).not.toBe("none");
    await page.mouse.up();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: /close dialog/i }).click({ force: true });
    await expect(page.getByRole("dialog")).not.toBeVisible();

    const firstBlock = page.getByTestId("time-block-item").first();
    await expect(firstBlock).toBeVisible();

    const resizeBottom = firstBlock.getByTestId("time-block-resize-bottom");
    const resizeBottomBox = await getBox(resizeBottom);
    await page.mouse.move(
      resizeBottomBox.x + resizeBottomBox.width / 2,
      resizeBottomBox.y + resizeBottomBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      resizeBottomBox.x + resizeBottomBox.width / 2,
      resizeBottomBox.y + resizeBottomBox.height / 2 + 70,
      {
        steps: 10,
      }
    );
    await expect(page.getByTestId("time-block-drag-ghost")).toBeVisible();
    await page.mouse.up();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(firstBlock).toBeVisible();

    const beforeMove = await getBox(firstBlock);
    await page.mouse.move(beforeMove.x + beforeMove.width / 2, beforeMove.y + 14);
    await page.mouse.down();
    await page.mouse.move(beforeMove.x + beforeMove.width / 2 + 10, beforeMove.y + 95, {
      steps: 12,
    });
    await expect(page.getByTestId("time-block-drag-ghost")).toBeVisible();
    await page.mouse.up();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("editor dialog width is constrained", async ({ page }) => {
    await ensureAuthed(page);
    await page.goto("/time-blocks");

    const grid = page.getByTestId("time-blocks-grid");
    await expect(grid).toBeVisible();
    const gridBox = await getBox(grid);

    const x = gridBox.x + gridBox.width * 0.92;
    const y = gridBox.y + 120;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 60, { steps: 8 });
    await page.mouse.up();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const dialogBox = await getBox(dialog);
    expect(dialogBox.width).toBeGreaterThanOrEqual(600);
    expect(dialogBox.width).toBeLessThanOrEqual(760);
  });

  test("blocks render inline dynamic geometry styles with distinct positions", async ({ page }) => {
    await ensureAuthed(page);
    await page.goto("/time-blocks");

    const blocks = page.getByTestId("time-block-item");
    await expect(blocks.first()).toBeVisible();
    const count = await blocks.count();
    expect(count).toBeGreaterThan(1);

    const styleSamples = await blocks.evaluateAll((nodes) =>
      nodes.slice(0, 12).map((node) => ({
        style: (node as HTMLElement).getAttribute("style") ?? "",
        top: (node as HTMLElement).style.top,
        left: (node as HTMLElement).style.left,
        width: (node as HTMLElement).style.width,
        height: (node as HTMLElement).style.height,
        rect: (() => {
          const r = (node as HTMLElement).getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        })(),
      }))
    );

    for (const sample of styleSamples) {
      expect(sample.style).toContain("top:");
      expect(sample.style).toContain("left:");
      expect(sample.style).toContain("width:");
      expect(sample.style).toContain("height:");
      expect(sample.width).not.toBe("");
      expect(sample.height).not.toBe("");
    }

    const uniqueTops = new Set(styleSamples.map((sample) => sample.top));
    expect(uniqueTops.size).toBeGreaterThan(1);

    const uniqueYs = new Set(styleSamples.map((sample) => Math.round(sample.rect.y)));
    expect(uniqueYs.size).toBeGreaterThan(1);
  });
});

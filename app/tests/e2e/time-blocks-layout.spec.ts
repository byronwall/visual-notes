import { expect, test, type Locator } from "@playwright/test";
import { ensureAuthed } from "./helpers/auth";
import { waitForAppReady } from "./helpers/readiness";

const centerY = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Expected element bounding box");
  return box.y + box.height / 2;
};

test.describe("time blocks layout", () => {
  test("calendar controls and columns align with target layout", async ({
    page,
  }) => {
    await ensureAuthed(page);
    await page.goto("/time-blocks");
    await waitForAppReady(page);

    const toolbar = page.getByTestId("time-blocks-header");
    const controls = [
      toolbar.getByRole("heading", { name: "Time Blocks" }),
      toolbar.getByRole("button", { name: "Previous range" }),
      toolbar.getByRole("button", { name: "Today", exact: true }),
      toolbar.getByRole("button", { name: "Next range" }),
      toolbar.getByTitle("Pick a start date"),
      toolbar.getByRole("button", { name: "List view" }),
      toolbar.getByRole("button", { name: "Day summary" }),
      toolbar.getByRole("button", { name: "Calendar settings" }),
    ];
    for (const control of controls) await expect(control).toBeVisible();
    await expect(toolbar.getByLabel("Start date")).toHaveAttribute(
      "type",
      "date",
    );

    // Every toolbar control sits on one row at desktop width.
    const controlYs = await Promise.all(controls.map(centerY));
    expect(Math.max(...controlYs) - Math.min(...controlYs)).toBeLessThan(8);

    // Seven consecutive days in one row; the range starts today by default.
    const headers = page.getByTestId("time-blocks-day-header");
    await expect(headers).toHaveCount(7);
    await expect(headers.first()).toHaveAttribute("data-today", "true");
    const weekdays = await headers.evaluateAll((nodes) =>
      nodes.map((node) => (node.textContent ?? "").slice(0, 3).toLowerCase()),
    );
    expect(new Set(weekdays).size).toBe(7);
    const headerBoxes = await headers.evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width };
      }),
    );
    const ys = headerBoxes.map((box) => box.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(2);
    for (let i = 1; i < headerBoxes.length; i += 1) {
      expect(headerBoxes[i].x).toBeGreaterThan(headerBoxes[i - 1].x);
    }

    // Header columns line up with the grid's day lanes.
    const grid = page.getByTestId("time-blocks-grid");
    await expect(grid).toBeVisible();
    const gridBox = await grid.boundingBox();
    if (!gridBox) throw new Error("Expected grid bounding box");
    expect(Math.abs(headerBoxes[0].x - gridBox.x)).toBeLessThan(2);
    const laneWidth = gridBox.width / 7;
    for (const box of headerBoxes) {
      expect(Math.abs(box.width - laneWidth)).toBeLessThan(2);
    }

    // Hour lines are stronger than the half-hour lines between them.
    const background = await grid.evaluate(
      (node) => (node as HTMLElement).style.backgroundImage,
    );
    expect(background).toContain("var(--colors-gray-a4) 1px");
    expect(background).toContain("var(--colors-gray-a2)");

    const scale = page.getByTestId("time-left-scale-row");
    await expect(scale.filter({ hasText: /^6:00$/ })).toHaveCount(1);
    await expect(scale.filter({ hasText: /^12:00$/ })).toHaveCount(1);

    const screenshot = await page.screenshot({ fullPage: true });
    await test.info().attach("time-blocks-layout", {
      body: screenshot,
      contentType: "image/png",
    });
  });
});

import { expect, test } from "@playwright/test";
import { ensureAuthed } from "./helpers/auth";

test.describe("time blocks layout", () => {
  test("calendar controls and columns align with target layout", async ({ page }) => {
    await ensureAuthed(page);
    await page.goto("/time-blocks");

    await expect(page.getByRole("heading", { name: /time blocks/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^previous$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^next$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /list view/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^summary$/i })).toBeVisible();
    const dateInput = page.locator("input[type='date']").first();
    await expect(dateInput).toBeVisible();

    await expect(page.getByText(/^Sun /)).toBeVisible();
    await expect(page.getByText(/^Sat /)).toBeVisible();
    const dayMetaButtons = page.locator("button[title^='Compact overlaps for ']");
    await expect(dayMetaButtons).toHaveCount(7);

    const buttonPositions = await dayMetaButtons.evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y };
      })
    );
    const ys = buttonPositions.map((pos) => pos.y);
    const xs = buttonPositions.map((pos) => pos.x);
    const ySpread = Math.max(...ys) - Math.min(...ys);
    expect(ySpread).toBeLessThan(6);
    expect(new Set(xs).size).toBeGreaterThan(5);

    const headerY = await page.evaluate(() => {
      const heading = document.querySelector("h1");
      const date = document.querySelector("input[type='date']");
      const list = Array.from(document.querySelectorAll("button")).find((node) =>
        /list view/i.test(node.textContent ?? "")
      );
      if (!heading || !date || !list) return null;
      return {
        heading: heading.getBoundingClientRect().y,
        date: date.getBoundingClientRect().y,
        list: list.getBoundingClientRect().y,
      };
    });
    expect(headerY).not.toBeNull();
    if (!headerY) throw new Error("Expected top controls to render");
    const headerYSpread =
      Math.max(headerY.heading, headerY.date, headerY.list) -
      Math.min(headerY.heading, headerY.date, headerY.list);
    expect(headerYSpread).toBeLessThan(8);

    const gutter = page.getByTestId("time-block-lane-gutter").first();
    await expect(gutter).toBeVisible();
    const gutterWidth = await gutter.evaluate((node) => node.getBoundingClientRect().width);
    expect(Math.round(gutterWidth)).toBe(20);

    const hourLine = page.getByTestId("time-grid-hour-line").first();
    const quarterLine = page.getByTestId("time-grid-quarter-line").first();
    await expect(hourLine).toBeVisible();
    await expect(quarterLine).toBeVisible();
    const lineStyles = await page.evaluate(() => {
      const hour = document.querySelector("[data-testid='time-grid-hour-line']") as HTMLElement | null;
      const quarter = document.querySelector(
        "[data-testid='time-grid-quarter-line']"
      ) as HTMLElement | null;
      if (!hour || !quarter) return null;
      const hourStyle = window.getComputedStyle(hour);
      const quarterStyle = window.getComputedStyle(quarter);
      const parseAlpha = (value: string) => {
        const match = value.match(/rgba?\(([^)]+)\)/i);
        if (!match) return 1;
        const parts = match[1].split(",").map((part) => part.trim());
        if (parts.length < 4) return 1;
        const alpha = Number(parts[3]);
        return Number.isFinite(alpha) ? alpha : 1;
      };
      return {
        hourBorderTop: parseFloat(hourStyle.borderTopWidth || "0"),
        quarterBorderTop: parseFloat(quarterStyle.borderTopWidth || "0"),
        hourBorderTopAlpha: parseAlpha(hourStyle.borderTopColor),
        quarterBorderTopAlpha: parseAlpha(quarterStyle.borderTopColor),
      };
    });
    expect(lineStyles).not.toBeNull();
    if (!lineStyles) throw new Error("Expected line styles");
    expect(lineStyles.hourBorderTop).toBeGreaterThanOrEqual(lineStyles.quarterBorderTop);
    expect(lineStyles.hourBorderTopAlpha).toBeGreaterThan(lineStyles.quarterBorderTopAlpha);

    await expect(page.locator("text=6:00").first()).toBeVisible();
    await expect(page.locator("text=12:00").first()).toBeVisible();

    const screenshot = await page.screenshot({ fullPage: true });
    await test.info().attach("time-blocks-layout", {
      body: screenshot,
      contentType: "image/png",
    });
  });
});

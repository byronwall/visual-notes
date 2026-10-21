import { expect, test } from "@playwright/test";
import { ensureAuthed } from "./helpers/auth";
import { callMcpTool, mcpToken } from "./helpers/mcp";
import { waitForAppReady } from "./helpers/readiness";

// An agent's calendar writes show up on an open time-blocks page without a
// reload: new blocks, moved blocks, and day values.

const todayAt = (hour: number, minute = 0) => {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};
const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("time blocks with an agent", () => {
  test.skip(!mcpToken(), "set MCP_DEV_TOKEN to drive /mcp");

  test("shows agent blocks and day values live", async ({ page, request }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const suffix = Date.now().toString().slice(-6);
    const blockByTitle = (title: string) =>
      page.getByTestId("time-block-item").filter({ hasText: title });

    const first = await callMcpTool(request, "time_blocks_create", {
      title: `Agent focus ${suffix}`,
      start: todayAt(19),
      end: todayAt(20),
    });

    await ensureAuthed(page);
    await page.goto("/time-blocks");
    await waitForAppReady(page);
    await expect(page.locator("html")).toHaveAttribute(
      "data-note-live",
      "open",
    );
    await expect(blockByTitle(`Agent focus ${suffix}`)).toBeVisible();

    // Created while the page is open.
    await callMcpTool(request, "time_blocks_create", {
      title: `Agent errand ${suffix}`,
      start: todayAt(20, 30),
      end: todayAt(21),
    });
    await expect(blockByTitle(`Agent errand ${suffix}`)).toBeVisible();

    // Renamed and moved later in the evening.
    const before = await blockByTitle(`Agent focus ${suffix}`).evaluate(
      (node) => parseFloat((node as HTMLElement).style.top),
    );
    await callMcpTool(request, "time_blocks_update", {
      updates: [
        {
          id: first.id,
          title: `Agent focus moved ${suffix}`,
          start: todayAt(21, 0),
          end: todayAt(21, 45),
        },
      ],
    });
    const moved = blockByTitle(`Agent focus moved ${suffix}`);
    await expect(moved).toBeVisible();
    expect(
      await moved.evaluate((node) =>
        parseFloat((node as HTMLElement).style.top),
      ),
    ).toBeGreaterThan(before);

    // A day value appears in today's header.
    await callMcpTool(request, "time_blocks_set_day_value", {
      day: localDay(),
      key: `e2e-${suffix}`,
      value: "agent",
    });
    await expect(
      page
        .getByTestId("time-blocks-day-meta")
        .filter({ hasText: `e2e-${suffix}` }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
});

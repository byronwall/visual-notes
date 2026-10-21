import { expect, test } from "@playwright/test";
import { ensureAuthed } from "./helpers/auth";
import { createArchivedPageFixture } from "./helpers/fixtures";
import { callMcpTool, mcpToken } from "./helpers/mcp";
import { waitForAppReady } from "./helpers/readiness";

// A note an agent adds to a saved page shows up in that page's open drawer.

test.describe("web archive with an agent", () => {
  test.skip(!mcpToken(), "set MCP_DEV_TOKEN to drive /mcp");

  test("shows an agent's note on the open page", async ({ page, request }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const suffix = Date.now().toString().slice(-6);
    const url = `https://agent-sync-${suffix}.example.com/article`;
    const pageId = await createArchivedPageFixture(request, {
      title: `Agent sync ${suffix}`,
      url,
    });

    const found = await callMcpTool(request, "archive_get", { url });
    expect(found).toMatchObject({ archived: true, id: pageId });

    await ensureAuthed(page);
    await page.goto(`/archive?item=${pageId}`);
    await waitForAppReady(page);
    await expect(page.locator("html")).toHaveAttribute(
      "data-note-live",
      "open",
    );
    const drawer = page.getByRole("dialog");
    await expect(drawer).toContainText(`Agent sync ${suffix}`);

    await callMcpTool(request, "archive_add_note", {
      pageId,
      text: `Agent summary ${suffix}`,
    });
    await expect(drawer).toContainText(`Agent summary ${suffix}`);
    expect(errors).toEqual([]);
  });
});

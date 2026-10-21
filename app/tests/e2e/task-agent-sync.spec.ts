import { expect, test, type Page } from "@playwright/test";
import { callMcpTool, mcpToken } from "./helpers/mcp";
import { waitForAppReady } from "./helpers/readiness";

// An agent's task writes show up on an open Tasks page, and "Move to list"
// sends a task with its subtasks to another list.

const rowByText = (page: Page, text: string) =>
  page.locator("[data-testid^='task-row-']").filter({ hasText: text }).first();
const shots = process.env.TASK_SHOTS_DIR;

test.describe("tasks with an agent", () => {
  test.skip(!mcpToken(), "set MCP_DEV_TOKEN to drive /mcp");

  test("shows agent tasks live and moves a task to another list", async ({
    page,
    request,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const suffix = Date.now().toString().slice(-6);
    const from = await callMcpTool(request, "tasks_create_list", {
      name: `Agent A ${suffix}`,
    });
    const to = await callMcpTool(request, "tasks_create_list", {
      name: `Agent B ${suffix}`,
    });
    const parent = await callMcpTool(request, "tasks_create", {
      list: from.id,
      description: `Plan launch ${suffix}`,
    });
    await callMcpTool(request, "tasks_create", {
      list: from.id,
      parentTaskId: parent.id,
      description: `Draft notes ${suffix}`,
    });

    await page.goto(`/tasks?list=${from.id}`);
    await waitForAppReady(page);
    await expect(page.locator("html")).toHaveAttribute(
      "data-note-live",
      "open",
    );
    await expect(rowByText(page, `Plan launch ${suffix}`)).toBeVisible();

    // A task the agent adds while the page is open appears without a reload.
    await callMcpTool(request, "tasks_create", {
      list: from.id,
      description: `Agent added ${suffix}`,
    });
    await expect(rowByText(page, `Agent added ${suffix}`)).toBeVisible();
    await callMcpTool(request, "tasks_update", {
      updates: [{ id: parent.id, status: "started" }],
    });
    await expect(page.getByTestId(`task-status-${parent.id}`)).toHaveAttribute(
      "data-status",
      "started",
    );

    const row = rowByText(page, `Plan launch ${suffix}`);
    await row.hover();
    await row
      .getByRole("button", { name: `Actions for Plan launch ${suffix}` })
      .click();
    await page.getByRole("menuitem", { name: "Move to list" }).click();
    await expect(
      page.getByRole("menuitem", { name: `Agent B ${suffix}` }),
    ).toBeVisible();
    if (shots) {
      await page.waitForTimeout(250); // let the submenu finish fading in
      await page.screenshot({ path: `${shots}/task-move-to-list.png` });
    }
    await page.getByRole("menuitem", { name: `Agent B ${suffix}` }).click();
    await expect(rowByText(page, `Plan launch ${suffix}`)).toHaveCount(0);

    // The row leaves at once; the server move lands a moment later.
    await expect
      .poll(async () =>
        (
          await callMcpTool<{ tasks: { description: string }[] }>(
            request,
            "tasks_query",
            { list: to.id },
          )
        ).tasks
          .map((task) => task.description)
          .sort(),
      )
      .toEqual([`Draft notes ${suffix}`, `Plan launch ${suffix}`]);
    expect(errors).toEqual([]);
  });
});

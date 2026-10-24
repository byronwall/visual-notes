import { expect, test } from "@playwright/test";
import { createNoteFixture, uniqueSuffix } from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";

test("dropped files become attachment cards that survive a reload", async ({
  page,
}) => {
  const title = `Files note ${uniqueSuffix()}`;
  const noteId = await createNoteFixture(page, {
    title,
    markdown: `# ${title}\n\nBody.`,
  });
  await page.goto(`/docs/${noteId}`);
  await waitForAppReady(page);

  const editor = page.locator(".ProseMirror");
  const box = (await editor.boundingBox())!;
  await page.evaluate(
    ({ x, y }) => {
      const dt = new DataTransfer();
      dt.items.add(
        new File(["%PDF-1.4\n%%EOF\n"], "contract.pdf", {
          type: "application/pdf",
        }),
      );
      dt.items.add(new File(["PK\u0003\u0004 zip"], "data.zip"));
      const target = document.querySelector(".ProseMirror")!;
      for (const type of ["dragenter", "dragover", "drop"]) {
        target.dispatchEvent(
          new DragEvent(type, {
            dataTransfer: dt,
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
          }),
        );
      }
    },
    { x: box.x + 40, y: box.y + box.height - 4 },
  );

  const cards = editor.locator("[data-file-attachment]");
  await expect(cards).toHaveCount(2, { timeout: 15_000 });
  await expect(cards.nth(0)).toContainText("contract.pdf");
  await expect(cards.nth(0)).toContainText("PDF · 15 B");
  await expect(cards.nth(1)).toContainText("data.zip");
  // A PDF opens in the browser; a zip only downloads.
  await expect(cards.nth(0).getByRole("link", { name: /^Open/ })).toHaveCount(
    1,
  );
  await expect(cards.nth(1).getByRole("link", { name: /^Open/ })).toHaveCount(
    0,
  );

  const href = await cards
    .nth(1)
    .getByRole("link", { name: /^Download/ })
    .getAttribute("href");
  expect(href).toMatch(
    /^\/api\/doc-files\/[a-f0-9]{64}\/data\.zip\?download=1$/,
  );
  const file = await page.request.get(href!);
  expect(file.status()).toBe(200);
  expect(file.headers()["content-disposition"]).toMatch(/^attachment;/);

  // The header says Unsaved/Saving… until the cards are stored.
  await expect(page.getByText(/^(Unsaved|Saving)/)).toHaveCount(0, {
    timeout: 10_000,
  });
  await page.reload();
  await waitForAppReady(page);
  await expect(page.locator(".ProseMirror [data-file-attachment]")).toHaveCount(
    2,
  );
});

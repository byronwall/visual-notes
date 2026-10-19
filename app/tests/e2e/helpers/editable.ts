import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Finds the inline editable whose preview currently shows `text`, then pins it
 * by its Ark root id so later lookups survive the preview text changing.
 */
export const pinEditableByText = async (
  scope: Page | Locator,
  text: string,
) => {
  const preview = scope
    .locator('[data-scope="editable"][data-part="preview"]')
    .filter({ hasText: text });
  await expect(preview).toHaveCount(1);
  const rootId = await preview.evaluate(
    (element) => element.closest('[data-part="root"]')?.id ?? "",
  );
  expect(rootId, "editable root should have an Ark id").toBeTruthy();
  const page = "page" in scope ? scope.page() : scope;
  const root = page.locator(`[id="${rootId}"]`);
  return {
    root,
    preview: root.locator('[data-part="preview"]'),
    input: root.locator('[data-part="input"]'),
  };
};

import { expect, type Page } from "@playwright/test";

export const waitForAppReady = (page: Page) =>
  expect(page.locator("html")).toHaveAttribute("data-app-hydrated", "true");

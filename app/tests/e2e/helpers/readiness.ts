import { expect, type Page } from "@playwright/test";

/**
 * Waits for the app's readiness marker, which `app.tsx` sets only after every
 * server-rendered node (including late-streamed Suspense content) is hydrated.
 * Clicking earlier can land on inert SSR markup that Solid then replaces.
 */
export const waitForAppReady = (page: Page) =>
  expect(page.locator("html")).toHaveAttribute("data-app-hydrated", "true");

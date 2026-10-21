import { defineConfig, devices } from "@playwright/test";
import { storageStatePath } from "./tests/e2e/global-setup";
import { knownBrokenSpecs } from "./tests/e2e/known-broken";

const fallbackPlaywrightPort = process.env.PLAYWRIGHT_PORT ?? "3100";
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  `http://127.0.0.1:${fallbackPlaywrightPort}`;
const webServerPort =
  process.env.PLAYWRIGHT_SERVER_PORT ??
  (() => {
    try {
      const parsed = new URL(baseURL);
      if (parsed.port) return parsed.port;
      return parsed.protocol === "https:" ? "443" : "80";
    } catch {
      return fallbackPlaywrightPort;
    }
  })();
const webServerEnv: NodeJS.ProcessEnv = { ...process.env };
delete webServerEnv.FORCE_COLOR;
delete webServerEnv.NO_COLOR;
webServerEnv.PORT = webServerPort;

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: process.env.CI
    ? Object.keys(knownBrokenSpecs).map((spec) => `**/${spec}.spec.ts`)
    : [],
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    storageState: storageStatePath,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        // PLAYWRIGHT_WEB_SERVER=dev skips the 1-4 minute production build for
        // a quick local run. CI always tests the production build.
        command: `set -a; source .env; set +a; unset NO_COLOR; ${
          process.env.PLAYWRIGHT_WEB_SERVER === "dev" && !process.env.CI
            ? "pnpm dev"
            : "pnpm build && pnpm start"
        }`,
        env: webServerEnv,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

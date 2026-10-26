import { solidStart } from "@solidjs/start/config";
import { nitro } from "nitro/vite";
import devtools from "solid-devtools/vite";
import { defineConfig } from "vite";
import lucidePreprocess from "vite-plugin-lucide-preprocess";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // vinxi read PORT and HOST; CI, Playwright, and the audit harness still set them.
  server: {
    port: Number(process.env.PORT) || 3000,
    host: process.env.HOST,
    strictPort: Boolean(process.env.PORT),
  },
  build: {
    rolldownOptions: {
      onwarn(warning, warn) {
        if (
          warning.code === "INVALID_ANNOTATION" &&
          typeof warning.id === "string" &&
          warning.id.includes("styled-system/jsx/")
        ) {
          return;
        }

        warn(warning);
      },
    },
  },
  plugins: [
    lucidePreprocess(),
    devtools({
      /* features options - all disabled by default */
      autoname: true, // e.g. enable autoname
      locator: {
        componentLocation: true,
        jsxLocation: true,
      },
    }),
    solidStart({ middleware: "./src/middleware.ts" }),
    nitro({
      preset: "node-server",
      features: { websocket: true },
      routes: {
        "/ws/jobs": "./src/ws/jobs.ts",
        "/ws/notes": "./src/ws/notes.ts",
      },
    }),
  ],
});

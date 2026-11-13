import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const app =
  process.env.COLLECTIONS_APP_ROOT || resolve(here, "../../../../app");
export default defineConfig({
  root: here,
  plugins: [solid()],
  resolve: {
    alias: [
      {
        find: "~/services/collections/collections.actions",
        replacement: here + "/actions.ts",
      },
      {
        find: "~/services/collections/collections.membership",
        replacement: here + "/membership.ts",
      },
      {
        find: "~/services/collections/collections.queries",
        replacement: here + "/queries.ts",
      },
      { find: /.*\/RowPeekPanel$/, replacement: here + "/peek.tsx" },
      { find: "~", replacement: app + "/src" },
      { find: "audit-styles", replacement: app + "/styled-system/styles.css" },
      { find: "styled-system", replacement: app + "/styled-system" },
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 3348,
    strictPort: true,
    fs: { allow: [here, app] },
  },
  css: { postcss: { plugins: [] } },
});

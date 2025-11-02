import { defineConfig } from "@solidjs/start/config";
import devtools from "solid-devtools/vite";

export default defineConfig({
  ssr: true,
  middleware: "./src/middleware.ts",
  vite: {
    plugins: [
      devtools({
        /* features options - all disabled by default */
        autoname: true, // e.g. enable autoname
        locator: {
          targetIDE: "cursor",
          componentLocation: true,
          jsxLocation: true,
        },
      }),
    ],
    ssr: {
      external: ["@prisma/client"],
    },
  },
});

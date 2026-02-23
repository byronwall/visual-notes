import { defineConfig } from "@solidjs/start/config";
import devtools from "solid-devtools/vite";
import lucidePreprocess from "vite-plugin-lucide-preprocess";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    experimental: {
      websocket: true,
    },
  },
  ssr: true,
  middleware: "./src/middleware.ts",
  vite: {
    build: {
      rollupOptions: {
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
      tsconfigPaths(),
      devtools({
        /* features options - all disabled by default */
        autoname: true, // e.g. enable autoname
        locator: {
          componentLocation: true,
          jsxLocation: true,
        },
      }),
    ],
    ssr: {
      external: ["@prisma/client"],
    },
    optimizeDeps: {
      include: ["solid-markdown > micromark", "solid-markdown > unified"],
    },
  },
}).addRouter({
  name: "ws",
  type: "http",
  handler: "./src/ws/jobs.ts",
  target: "server",
  base: "/ws/jobs",
});

// app.config.ts
import { defineConfig } from "@solidjs/start/config";
import devtools from "solid-devtools/vite";
import lucidePreprocess from "vite-plugin-lucide-preprocess";
import tsconfigPaths from "vite-tsconfig-paths";
var app_config_default = defineConfig({
  server: {
    experimental: {
      websocket: true
    }
  },
  ssr: true,
  middleware: "./src/middleware.ts",
  vite: {
    plugins: [
      lucidePreprocess(),
      tsconfigPaths(),
      devtools({
        /* features options - all disabled by default */
        autoname: true,
        // e.g. enable autoname
        locator: {
          componentLocation: true,
          jsxLocation: true
        }
      })
    ],
    ssr: {
      external: ["@prisma/client"]
    },
    optimizeDeps: {
      include: ["solid-markdown > micromark", "solid-markdown > unified"]
    }
  }
}).addRouter({
  name: "ws",
  type: "http",
  handler: "./src/ws/jobs.ts",
  target: "server",
  base: "/ws/jobs"
});
export {
  app_config_default as default
};

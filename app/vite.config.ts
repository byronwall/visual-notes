import { solidStart } from "@solidjs/start/config";
import { nitro } from "nitro/vite";
import devtools from "solid-devtools/vite";
import { defineConfig } from "vite";
import lucidePreprocess from "vite-plugin-lucide-preprocess";

// In the client build, "use server" leaves these modules imported but unused.
// Their top-level code is only definitions, so drop them: otherwise a bare
// import keeps the 1 MB note schema on routes that never edit a note.
const pureOnClient = /\/src\/(server|lib\/note-content)\//;

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
    {
      // A plugin, because solidStart sets the client's `treeshake: true` after
      // the user config and replaces an object set there.
      name: "client-pure-modules",
      enforce: "post",
      configEnvironment: (name) =>
        name === "client"
          ? {
              build: {
                rolldownOptions: {
                  treeshake: {
                    moduleSideEffects: (id: string) =>
                      pureOnClient.test(id) ? false : undefined,
                  },
                },
              },
            }
          : undefined,
    },
    lucidePreprocess(),
    devtools({
      /* features options - all disabled by default */
      autoname: true, // e.g. enable autoname
      locator: {
        componentLocation: true,
        jsxLocation: true,
      },
    }),
    // Its reload fires on a failed hover preload too, so going offline dropped
    // the page and any unsaved note. app.tsx ignores failed preloads instead.
    solidStart({
      middleware: "./src/middleware.ts",
      reloadOnRouteChunkError: false,
    }),
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

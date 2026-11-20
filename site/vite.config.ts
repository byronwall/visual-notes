import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

// The public landing page. SITE_BASE is the path the site is served from:
// the GitHub Pages project path by default, `/` once it has its own domain.
export default defineConfig({
  base: process.env.SITE_BASE ?? "/visual-notes/",
  plugins: [solid()],
  server: { port: 3360 },
});

import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { pathwaysApi } from "./server/api";

export default defineConfig({
  plugins: [solid(), pathwaysApi()],
  server: { port: 5174, strictPort: true },
});

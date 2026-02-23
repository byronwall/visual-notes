import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/**/*.test.{ts,tsx,js,jsx}",
      "src/**/*.spec.{ts,tsx,js,jsx}",
      "tests/unit/**/*.test.{ts,tsx,js,jsx}",
      "tests/unit/**/*.spec.{ts,tsx,js,jsx}",
    ],
    exclude: [
      "**/node_modules/**",
      "tests/e2e/**",
    ],
  },
  resolve: {
    alias: {
      "~": resolve(__dirname, "src"),
    },
  },
});

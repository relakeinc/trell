import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@trell/sdk": path.resolve(__dirname, "../sdk/src/index.ts"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    environmentMatchGlobs: [["test/**/*.browser.test.ts", "jsdom"]],
  },
});

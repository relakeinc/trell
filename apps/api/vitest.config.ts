import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sdkAlias = {
  "@trell/sdk": path.resolve(__dirname, "../sdk/src/index.ts"),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: sdkAlias },
        test: {
          name: "node",
          include: ["test/**/*.test.ts"],
          exclude: ["test/**/*.browser.test.ts"],
          environment: "node",
        },
      },
      {
        resolve: { alias: sdkAlias },
        test: {
          name: "browser",
          include: ["test/**/*.browser.test.ts"],
          environment: "jsdom",
        },
      },
    ],
  },
});

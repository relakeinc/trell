import { defineConfig } from "tsup";

// In watch mode (`tsup --watch`, used by `turbo run dev`) the output folder
// must NOT be cleaned: dependents like @trell/api import from `dist/` while
// the watcher rebuilds, and a clean wipes the files under their feet
// (ERR_MODULE_NOT_FOUND at startup). One-shot builds still clean.
const watching = process.argv.includes("--watch");

export default defineConfig({
  entry: {
    index: "src/index.ts",
    schemas: "src/schemas.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: !watching,
  target: "es2020",
  splitting: false,
  treeshake: true,
});

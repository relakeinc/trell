import { defineConfig } from "tsup";

// Same as @trell/shared: never clean in watch mode so concurrent dev tasks
// don't observe a half-deleted `dist/`.
const watching = process.argv.includes("--watch");

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs", "iife"],
  globalName: "TrellSDK",
  platform: "browser",
  target: "es2017",
  dts: true,
  clean: !watching,
  minify: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
});

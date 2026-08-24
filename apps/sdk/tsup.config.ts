import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs", "iife"],
  globalName: "TrellSDK",
  platform: "browser",
  target: "es2017",
  dts: true,
  clean: true,
  minify: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
});

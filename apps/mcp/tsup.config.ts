import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  target: "es2020",
  splitting: false,
  treeshake: true,
  noExternal: ["@trell/shared"],
});

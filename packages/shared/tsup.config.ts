import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    schemas: "src/schemas.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  target: "es2020",
  splitting: false,
  treeshake: true,
});

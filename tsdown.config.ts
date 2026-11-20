import { defineConfig } from "tsdown";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    outDir: "dist",
    dts: true,
    clean: true,
    sourcemap: false,
    minify: false,
    outExtensions: ({ format }) => ({
        js: format === "cjs" ? ".cjs" : ".mjs",
    }),
});

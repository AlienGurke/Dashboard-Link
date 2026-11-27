import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// One self-contained HTML file: works online (GitHub Pages) and offline (double-click).
// Nothing is loaded from other servers.
export default defineConfig({
  base: "./",
  plugins: [preact(), viteSingleFile()],
  build: { target: "es2020", assetsInlineLimit: 100_000_000 },
});

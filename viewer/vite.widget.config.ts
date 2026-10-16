import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
export default defineConfig(({ mode }) => ({
  plugins: [react(), viteSingleFile()],
  publicDir: false,
  build: {
    outDir: "dist-widget",
    emptyOutDir: mode !== "preview",
    rollupOptions: {
      input: mode === "preview" ? "preview.html" : "widget.html",
    },
  },
}));

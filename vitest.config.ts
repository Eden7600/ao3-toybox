import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@src": resolve(__dirname, "src"),
      "@assets": resolve(__dirname, "src/assets"),
      "@common": resolve(__dirname, "src/common"),
    },
  },
  test: {
    environment: "happy-dom",
    css: true,
    // Tests live outside src/ because content scripts are auto-registered
    // from src/content/scripts via import.meta.glob
    include: ["tests/**/*.test.ts"],
  },
});

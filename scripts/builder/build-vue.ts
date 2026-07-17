import type { Args } from "./args";

import { createServer, build as viteBuild, type InlineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve, dirname } from "node:path";

export async function buildVue(args: Args, entry: string, outPath: string) {
  const isDev = args.environment === "development";

  const viteConfig: InlineConfig = {
    resolve: {
      alias: {
        "@src": resolve(process.cwd(), "src"),
        "@assets": resolve(process.cwd(), "src/assets"),
        "@common": resolve(process.cwd(), "src/common"),
      },
    },
    base: "./",
    configFile: false,
    root: resolve(process.cwd(), dirname(entry)),
    plugins: [vue()],
    build: {
      sourcemap: isDev ? "inline" : false,
      minify: !isDev,
      terserOptions: {
        mangle: false,
      },
      outDir: resolve(process.cwd(), `dist/${args.browser}/${outPath}`),
      emptyOutDir: false,
      rollupOptions: {
        input: resolve(process.cwd(), entry),
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: "[name].js",
          assetFileNames: "[name][extname]",
        },
      },
    },
    define: {
      "process.env.NODE_ENV": `"${args.environment}"`,
      "process.env.BROWSER": `"${args.browser}"`,
      "process.env.SERVER_FEATURES": `"${args.serverFeatures}"`,
    },
  };

  if (args.command === "watch") {
    const server = await createServer(viteConfig);
    await server.listen();
    server.printUrls();
  } else {
    await viteBuild(viteConfig);
  }
}

import { dirname, resolve } from "node:path";
import { build as viteBuild, type InlineConfig } from "vite";
import type { Args } from "./args";

export async function buildScript(args: Args, entry: string, outPath: string) {
  console.log(entry, outPath, process.cwd());

  const isDev = args.environment === "development";
  const outDir = resolve(
    process.cwd(),
    `dist/${args.browser}`,
    dirname(outPath),
  );

  const viteConfig: InlineConfig = {
    resolve: {
      alias: {
        "@src": resolve(process.cwd(), "src"),
        "@assets": resolve(process.cwd(), "src/assets"),
        "@common": resolve(process.cwd(), "src/common"),
      },
    },
    configFile: false,
    build: {
      sourcemap: isDev ? "inline" : false,
      minify: !isDev,
      watch: args.command === "watch" ? {} : undefined,
      outDir,
      emptyOutDir: false,
      reportCompressedSize: true,
      lib: {
        entry,
        formats: ["iife"],
        fileName: () => "[name].js",
        name: "script",
      },
    },
    define: {
      "process.env.NODE_ENV": `"${args.environment}"`,
      "process.env.BROWSER": `"${args.browser}"`,
      "process.env.SERVER_FEATURES": `"${args.serverFeatures}"`,
    },
  };

  await viteBuild(viteConfig);
}

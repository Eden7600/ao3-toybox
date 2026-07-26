import { build as esbuild } from "esbuild";
import { resolve } from "node:path";
import type { Args } from "./args";

/**
 * Standalone worker bundles: fully self-contained IIFEs the content
 * script fetches and runs as page-origin blob workers. onnxruntime-web
 * aliases to its bundled build so no module code is ever fetched at
 * runtime (MV3 remote-code rule); only wasm binaries packaged in the
 * extension and the user-consented voice model are fetched. Node
 * builtins stay external — piper's emscripten glue references them
 * behind environment guards that never run in a browser.
 */
const WORKERS = [
  {
    entry: "src/content/tts-piper-worker.ts",
    outPath: "content/tts-piper-worker.js",
  },
];

export async function buildWorkers(args: Args): Promise<void> {
  const isDev = args.environment === "development";

  await Promise.all(
    WORKERS.map(({ entry, outPath }) =>
      esbuild({
        entryPoints: [resolve(process.cwd(), entry)],
        outfile: resolve(process.cwd(), `dist/${args.browser}`, outPath),
        bundle: true,
        format: "iife",
        minify: !isDev,
        sourcemap: isDev ? "inline" : false,
        alias: {
          "onnxruntime-web": resolve(
            process.cwd(),
            "node_modules/onnxruntime-web/dist/ort.bundle.min.mjs",
          ),
          "@src": resolve(process.cwd(), "src"),
        },
        external: ["fs", "path", "url", "module", "worker_threads"],
        define: {
          "process.env.NODE_ENV": `"${args.environment}"`,
          "process.env.BROWSER": `"${args.browser}"`,
        },
      }),
    ),
  );
}

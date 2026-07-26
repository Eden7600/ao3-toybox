import { cp, mkdir } from "fs/promises";
import { dirname, resolve } from "path";
import getManifest from "../../src/manifest";
import type { Args } from "./args";

export async function buildAssets(args: Args) {
  const manifest = getManifest();
  const outDir = resolve(process.cwd(), `dist/${args.browser}`);

  // Helper to resolve and copy paths
  const copyAsset = async (sourcePath: string) => {
    const resolvedSource = resolve(
      process.cwd(),
      "src",
      sourcePath.replace(/^\.\//, ""),
    );
    const resolvedTarget = resolve(outDir, sourcePath);

    // Create the target directory
    await mkdir(dirname(resolvedTarget), { recursive: true });

    // Copy the file
    await cp(resolvedSource, resolvedTarget, { recursive: true });
  };

  // Copy icons
  if (manifest.icons) {
    for (const path of Object.values(manifest.icons)) {
      if (path) {
        // eslint-disable-next-line no-await-in-loop
        await copyAsset(path);
      }
    }
  }

  // Packaged wasm for the Piper read-aloud worker: shipping these in the
  // package (rather than fetching from a CDN) is what keeps the enhanced
  // voice tier inside the stores' no-remote-code rules. The ORT glue and
  // binary versions must match the pinned onnxruntime-web dependency.
  const ttsAssets = [
    "onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs",
    "onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm",
    "@diffusionstudio/piper-wasm/build/piper_phonemize.wasm",
    "@diffusionstudio/piper-wasm/build/piper_phonemize.data",
  ];

  for (const asset of ttsAssets) {
    const target = resolve(outDir, "tts", asset.split("/").at(-1) ?? "");

    // eslint-disable-next-line no-await-in-loop
    await mkdir(dirname(target), { recursive: true });
    // eslint-disable-next-line no-await-in-loop
    await cp(resolve(process.cwd(), "node_modules", asset), target);
  }
}

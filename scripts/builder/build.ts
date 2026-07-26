import { parseCommandArgs } from "./args";
import { buildAssets } from "./build-assets";
import { buildManifest } from "./build-manifest";
import { buildScript } from "./build-script";
import { buildVue } from "./build-vue";
import { buildWorkers } from "./build-worker";
import { cleanDist } from "./clean";
import { detectScripts } from "./parse-manifest";

async function build() {
  const args = parseCommandArgs();

  console.log(
    "Starting build for ",
    args.browser,
    "in",
    args.environment,
    "mode",
  );

  // 1. Clean dist
  await cleanDist(args);

  // 2. Parse
  const detected = detectScripts();

  // 3. Build manifest
  await buildManifest(args);

  // 4. Copy static assets
  await buildAssets(args);

  // 5. Build all detected scripts
  const scriptPromises = [
    ...detected.contentScripts.map(({ entry, outPath }) =>
      buildScript(args, entry, outPath),
    ),
    ...detected.backgroundScripts.map(({ entry, outPath }) =>
      buildScript(args, entry, outPath),
    ),
  ];

  // 6. Build all UI pages
  const uiPromises = detected.uiPages.map(({ entry, outPath }) =>
    buildVue(args, entry, outPath),
  );

  // Wait for everything to complete
  await Promise.all([...scriptPromises, ...uiPromises, buildWorkers(args)]);
}

await build();

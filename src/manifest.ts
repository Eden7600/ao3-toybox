import type { PartialDeep } from "type-fest";
import packageJson from "../package.json";
import { AO3_ALTERNATE_MATCH_PATTERNS, AO3_MATCH_PATTERNS } from "./common/ao3";

// The data_collection_permissions key is newer than the bundled manifest
// types: AMO requires the disclosure for new listings.
type GeckoSettings =
  PartialDeep<browser._manifest.FirefoxSpecificProperties> & {
    data_collection_permissions?: { required: string[] };
  };

export default function (): PartialDeep<browser._manifest.WebExtensionManifest> {
  const firefox = process.env.BROWSER === "firefox";
  const chrome = process.env.BROWSER === "chrome";

  return {
    manifest_version: 3,
    name: "AO3 Toybox",
    short_name: "AO3 Toybox",
    description: "A refined reading experience for AO3",
    author: "Eden7600",
    version: packageJson.version,
    // Icon paths must not carry a "./" prefix: the Chrome Web Store
    // validator reports them as missing from the package (the browser
    // itself resolves either form, so local loads never caught it)
    icons: {
      ...(firefox && {
        48: "icons/icon.svg",
        96: "icons/icon.svg",
      }),
      ...(chrome && {
        16: "icons/icon-16.png",
        32: "icons/icon-32.png",
        48: "icons/icon-48.png",
        96: "icons/icon-96.png",
        128: "icons/icon-128.png",
        256: "icons/icon-256.png",
      }),
    },
    background: {
      ...(firefox && {
        scripts: ["./background/background.ts"],
        type: "module",
      }),
      ...(chrome && {
        service_worker: "./background/background.ts",
        type: "module",
      }),
    },
    options_ui: {
      page: "./options_ui/index.html",
      open_in_tab: true,
    },
    action: {
      default_popup: "./popup/index.html",
    },
    content_scripts: [
      // First so the redirect wins the race against the other scripts'
      // work on alternative-domain pages
      {
        matches: AO3_ALTERNATE_MATCH_PATTERNS,
        js: ["./content/domain-redirect.ts"],
        run_at: "document_start",
      },
      {
        matches: AO3_MATCH_PATTERNS,
        js: ["./content/content.ts"],
        run_at: "document_idle",
      },
      {
        matches: AO3_MATCH_PATTERNS,
        js: ["./ao3_theme_injector/ao3_theme_injector.ts"],
        run_at: "document_start",
      },
    ],
    // Firefox-only: the svg only ships in the Firefox package, and a
    // declared-but-missing file risks store-validator rejections
    ...(firefox && {
      web_accessible_resources: [
        {
          resources: ["icons/icon.svg"],
          matches: AO3_MATCH_PATTERNS,
        },
      ],
    }),
    permissions: ["storage", "unlimitedStorage"],
    host_permissions: AO3_MATCH_PATTERNS,
    ...(firefox && {
      browser_specific_settings: {
        gecko: {
          // Needed for proper storage
          id: "ao3-toybox@eden7600",
          // The data_collection_permissions key requires FF140+ (CSS nesting needs 117+)
          strict_min_version: "140.0",
          // Everything stays in the browser, so: none.
          data_collection_permissions: { required: ["none"] },
        } satisfies GeckoSettings,
        gecko_android: {
          // The data_collection_permissions key requires Android FF142+
          strict_min_version: "142.0",
        },
      },
    }),
    ...(chrome && {
      // CSS nesting is only supported in Chrome 120+
      minimum_chrome_version: "120.0",
    }),
  };
}

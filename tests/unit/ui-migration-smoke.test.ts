// Mounts the options app and walks every route to surface render errors —
// the only automated coverage the Vue views get.
import { describe, expect, it, vi } from "vitest";
import { createApp, nextTick } from "vue";

type Callback<T> = (result: T) => void;

vi.stubGlobal("chrome", {
  storage: {
    local: {
      get: (_keys: unknown, cb?: Callback<Record<string, unknown>>) => {
        if (cb) cb({});
        return Promise.resolve({});
      },
      set: (_items: unknown, cb?: Callback<void>) => {
        if (cb) cb(undefined);
        return Promise.resolve();
      },
    },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  runtime: {
    id: "smoke-test",
    getManifest: () => ({ version: "0.0.0-test" }),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    sendMessage: vi.fn(),
  },
});

describe("options UI smoke", () => {
  it("mounts and renders every route without throwing", { timeout: 30_000 }, async () => {
    const { default: App } = await import("@src/options_ui/App.vue");
    const { default: router } = await import("@src/options_ui/router");

    const errors: unknown[] = [];
    const host = document.createElement("div");
    document.body.appendChild(host);

    const app = createApp(App);
    app.config.errorHandler = (err) => {
      errors.push(err);
    };
    app.use(router);

    await router.push("/welcome");
    await router.isReady();
    app.mount(host);
    await nextTick();

    const paths = [
      "/theme",
      "/listings",
      "/hide-works",
      "/tracking",
      "/reading",
      "/common-tags",
      "/regex-tags",
      "/export",
    ];

    for (const path of paths) {
      await router.push(path);
      await nextTick();
      await nextTick();
      expect(errors, `route ${path} raised: ${String(errors[0])}`).toEqual([]);
      expect(host.innerHTML.length).toBeGreaterThan(0);
    }

    app.unmount();
  });
});

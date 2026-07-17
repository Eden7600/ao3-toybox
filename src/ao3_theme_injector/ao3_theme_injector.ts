import {
  getAllSettings,
  normalizeStoredSettings,
  type StoredSettings,
} from "@src/common/settings";
import { prepareCss } from "./prepare-css";
import { sameThemeOptions, themeCssOptions } from "./theme-options";

async function runThemeInjector() {
  // Mutable: the storage listener below swaps this when theme settings
  // change, so createNode always renders the latest options.
  let options = themeCssOptions(await getAllSettings());

  // It may be a bit Cargo Cult-y, but I'm replicating some of the logic from DarkReader's
  // theme injector. their dark wizardry is a bit beyond me, but their methodology seems
  // performant and reliable.

  const selectNode = () =>
    document.getElementById("toybox-theme-injector-style");

  const createNode = (target: HTMLElement) => {
    const styleTag = document.createElement("style");
    styleTag.id = "toybox-theme-injector-style";
    styleTag.textContent = prepareCss(options);
    target.appendChild(styleTag);
  };

  const selectTarget = () => document.body;

  const createTarget = () => {
    const body = document.createElement("body");
    document.documentElement.insertBefore(
      body,
      document.documentElement.firstElementChild,
    );

    return body;
  };

  const isTargetMutation = (mutation: { target: { nodeName: string } }) =>
    mutation.target.nodeName.toLowerCase() === "body";

  const target = selectTarget();

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (target) {
    console.log("Target exists, creating node");
    createNode(target);

    const lock = document.createElement("meta");
    lock.name = "darkreader-lock";
    target.appendChild(lock);
  } else {
    const observer = new MutationObserver((mutations) => {
      const mutation = mutations.find(isTargetMutation);

      if (mutation) {
        unsubscribe();
        const target = selectTarget();

        if (selectNode() === null) {
          createNode(target);
        }

        // This stops DarkReader from applying its own theme to the page.
        // This is necessary because DarkReader will apply its theme to the page, and because the
        // site is light-themed by default, it will apply a dark theme to the page.

        const lock = document.createElement("meta");
        lock.name = "darkreader-lock";
        target.appendChild(lock);
      }
    });

    const ready = () => {
      if (document.readyState !== "complete") {
        return;
      }

      unsubscribe();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const target = selectTarget() || createTarget();

      if (selectNode() === null) {
        createNode(target);
      }
    };

    const unsubscribe = () => {
      document.removeEventListener("readystatechange", ready);
      observer.disconnect();
    };

    if (document.readyState === "complete") {
      ready();
    } else {
      // The readystatechange event is not cancellable and does not bubble
      document.addEventListener("readystatechange", ready);
      observer.observe(document, { childList: true, subtree: true });
    }
  }

  // Live updates: theme changes made in the popup or options page land in
  // storage; re-render the injected stylesheet in place so open tabs
  // restyle without a reload.
  const api = typeof chrome === "undefined" ? browser : chrome;

  api.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !("settings" in changes)) return;

    const next = themeCssOptions(
      normalizeStoredSettings(
        changes.settings.newValue as StoredSettings | null,
      ),
    );

    if (sameThemeOptions(options, next)) return;

    options = next;

    const node = selectNode();

    if (node) {
      node.textContent = prepareCss(options);
    } else {
      // Storage events only fire on a live page, so body exists by now
      createNode(selectTarget());
    }
  });
}

void runThemeInjector();

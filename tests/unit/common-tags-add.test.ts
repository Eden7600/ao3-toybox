// Regression test for the new-tag DataCloneError: the object handed to
// Dexie must survive structured clone — IndexedDB rejects Vue's reactive
// Proxy arrays, so aliases must reach the db as a plain array.
import { describe, expect, it, vi } from "vitest";
import { createApp, nextTick } from "vue";

const added: Array<Record<string, unknown>> = [];

vi.mock("@src/common/db/Database", () => ({
  db: {
    commonTags: {
      toArray() {
        return Promise.resolve([]);
      },
      add(tag: Record<string, unknown>) {
        // Real IndexedDB structured-clones the value on add; cloning here
        // makes the mock throw DataCloneError on proxies just like it does.
        added.push(structuredClone(tag));

        return Promise.resolve(42);
      },
    },
  },
}));

const clickButton = (label: string) => {
  const button = [...document.querySelectorAll("button")].find((b) =>
    b.textContent.includes(label),
  );

  if (!button) throw new Error(`No button labeled "${label}"`);
  button.click();
};

const typeInto = (id: string, text: string) => {
  const field = document.getElementById(id) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | null;

  if (!field) throw new Error(`No field #${id}`);
  field.value = text;
  field.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("CommonTags new-tag save", () => {
  // Importing the view (plus UI kit) transforms inside the test body, which
  // blows the 5s default when the full suite competes for workers
  it(
    "hands Dexie a structured-cloneable tag with a plain aliases array",
    { timeout: 30_000 },
    async () => {
      const { default: CommonTags } = await import(
        "@src/options_ui/views/tags/CommonTags.vue"
      );

      const host = document.createElement("div");

      document.body.appendChild(host);

      const app = createApp(CommonTags);

      app.mount(host);
      await nextTick();

      clickButton("New Tag");
      await nextTick();

      typeInto("newName", "  Enemies to Lovers  ");
      typeInto("newAliases", "e2l\n enemies 2 lovers \n\n");
      await nextTick();

      clickButton("Save");
      await vi.waitFor(
        () => {
          expect(added).toHaveLength(1);
        },
        { timeout: 10_000 },
      );

      expect(added[0]).toMatchObject({
        name: "Enemies to Lovers",
        aliases: ["e2l", "enemies 2 lovers"],
      });
      // Dexie's ++id key generator must assign the id, not the caller
      expect(added[0].id).toBeUndefined();

      app.unmount();
      host.remove();
    },
  );
});

import {
  DOCK_ORDER,
  dockCornerHost,
  setDockDetached,
} from "@src/content/corner-dock";
import { beforeEach, describe, expect, it } from "vitest";

const dockElement = () =>
  document.querySelector<HTMLElement>("[data-toybox-corner-dock]");

const mount = (order: number) => {
  const host = document.createElement("div");

  dockCornerHost(host, order);

  return host;
};

beforeEach(() => {
  dockElement()?.remove();
});

describe("corner dock", () => {
  it("creates a single fixed column and fuses hosts by order", () => {
    const settings = mount(DOCK_ORDER.readingSettings);
    const tts = mount(DOCK_ORDER.ttsPlayer);

    expect(dockElement()).not.toBeNull();
    expect(settings.dataset.dockPos).toBe("top");
    expect(tts.dataset.dockPos).toBe("bottom");
    expect(settings.style.marginTop).toBe("0px");
    expect(tts.style.marginTop).toBe("0px");
  });

  it("assigns positions by slot order, not mount order", () => {
    const tts = mount(DOCK_ORDER.ttsPlayer);
    const settings = mount(DOCK_ORDER.readingSettings);

    expect(settings.dataset.dockPos).toBe("top");
    expect(tts.dataset.dockPos).toBe("bottom");
  });

  it("marks a lone host solo", () => {
    expect(mount(1).dataset.dockPos).toBe("solo");
  });

  it("gives three fused hosts a middle segment", () => {
    const [a, b, c] = [mount(1), mount(2), mount(3)];

    expect(a.dataset.dockPos).toBe("top");
    expect(b.dataset.dockPos).toBe("middle");
    expect(c.dataset.dockPos).toBe("bottom");
  });

  it("detaching a segment re-fuses the rest and adds spacing", () => {
    const settings = mount(DOCK_ORDER.readingSettings);
    const tts = mount(DOCK_ORDER.ttsPlayer);

    setDockDetached(tts, true);

    expect(settings.dataset.dockPos).toBe("solo");
    expect(tts.dataset.dockPos).toBe("solo");
    expect(tts.style.marginTop).toBe("8px");

    setDockDetached(tts, false);

    expect(settings.dataset.dockPos).toBe("top");
    expect(tts.dataset.dockPos).toBe("bottom");
    expect(tts.style.marginTop).toBe("0px");
  });
});

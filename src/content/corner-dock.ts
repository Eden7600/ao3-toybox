// The bottom-right corner collects controls from independent content
// scripts (reading settings, read-aloud player), each in its own shadow
// host. The dock is the shared light-DOM column that keeps them on one
// axis and lets collapsed segments fuse into a single pill: every host
// is stamped with data-dock-pos (top/middle/bottom/solo), which the
// shadow stylesheets key their corner rounding and seam borders off.
// A segment that expands (the open player) marks itself detached and
// gets spaced apart while the remaining segments re-fuse.

/** Visual order in the column, top to bottom. */
export const DOCK_ORDER = {
  readingSettings: 1,
  ttsPlayer: 2,
} as const;

let dock: HTMLDivElement | null = null;

function cornerDock(): HTMLDivElement {
  if (dock?.isConnected) {
    return dock;
  }

  dock = document.createElement("div");
  dock.dataset.toyboxCornerDock = "true";
  // Pointer events pass through the column's empty width; the hosts
  // opt back in
  dock.style.cssText =
    "position: fixed; bottom: 20px; right: 20px; z-index: 2147483646; " +
    "display: flex; flex-direction: column; align-items: flex-end; " +
    "pointer-events: none;";
  document.body.appendChild(dock);

  return dock;
}

/** Mounts a shadow host into the corner column at the given slot. */
export function dockCornerHost(host: HTMLElement, order: number): void {
  host.style.pointerEvents = "auto";
  host.style.order = String(order);
  // Lower segments paint above upper ones so an open popover from the
  // bottom row is never shadowed by the pill above it
  host.style.position = "relative";
  host.style.zIndex = String(order);
  cornerDock().appendChild(host);
  refreshDock();
}

/** An expanded segment leaves the fused pill until it collapses again. */
export function setDockDetached(host: HTMLElement, detached: boolean): void {
  if (detached) {
    host.dataset.dockDetached = "true";
  } else {
    delete host.dataset.dockDetached;
  }

  refreshDock();
}

function refreshDock(): void {
  if (!dock?.isConnected) {
    return;
  }

  const hosts = [...dock.children]
    .filter((child): child is HTMLElement => child instanceof HTMLElement)
    .sort((a, b) => Number(a.style.order) - Number(b.style.order));
  const fused = hosts.filter((host) => host.dataset.dockDetached === undefined);

  for (const host of hosts) {
    if (host.dataset.dockDetached !== undefined) {
      host.dataset.dockPos = "solo";
      continue;
    }

    const index = fused.indexOf(host);

    host.dataset.dockPos =
      fused.length === 1
        ? "solo"
        : index === 0
          ? "top"
          : index === fused.length - 1
            ? "bottom"
            : "middle";
  }

  // Fused neighbours sit flush; any other adjacency gets breathing room
  hosts.forEach((host, index) => {
    const flush =
      index > 0 &&
      host.dataset.dockDetached === undefined &&
      hosts[index - 1].dataset.dockDetached === undefined;

    host.style.marginTop = index === 0 || flush ? "0px" : "8px";
  });
}

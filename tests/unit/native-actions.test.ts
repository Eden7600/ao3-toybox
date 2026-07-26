import {
  collectFeedbackActions,
  collectNativeActions,
} from "@src/content/native-actions";
import { beforeEach, describe, expect, it } from "vitest";

// Mirrors otwarchive's _work_header_navigation partial: chapter index
// (button toggle + select of chapter ids), plain chapter links, share
// modal anchor, download expandable, subscribe/mark forms, bookmark and
// comments links, a hash-href style toggle, and a noscript-only li.
const NAV_FIXTURE = `
<ul class="work navigation actions" role="menu">
  <li class="chapter">
    <noscript><a href="/works/999/navigate">Chapter Index</a></noscript>
    <button>Chapter Index</button>
    <ul id="chapter_index" class="expandable secondary hidden">
      <li>
        <form action="/works/999/chapters" method="get">
          <select id="selected_id" name="selected_id">
            <option value="101">1. The Beginning</option>
            <option value="102" selected>2. The Middle</option>
          </select>
          <input type="submit" value="Go" />
        </form>
      </li>
    </ul>
  </li>
  <li class="chapter entire"><a href="/works/999?view_full_work=true">Entire Work</a></li>
  <li class="chapter previous"><a href="/works/999/chapters/101#workskin">← Previous Chapter</a></li>
  <li class="share"><a href="/works/999/share" class="modal">Share</a></li>
  <li class="download">
    <button>Download</button>
    <ul class="expandable secondary">
      <li><a href="/downloads/999/work.epub">EPUB</a></li>
      <li><a href="/downloads/999/work.pdf">PDF</a></li>
    </ul>
  </li>
  <li class="subscribe">
    <form action="/subscriptions" method="post"><input type="submit" value="Subscribe" /></form>
  </li>
  <li class="mark">
    <form action="/mark" method="post"><input type="submit" value="Mark for Later" /></form>
  </li>
  <li class="bookmark"><a href="/works/999/bookmarks/new">Bookmark</a></li>
  <li class="comments" id="show_comments_link_top"><a href="/works/999?show_comments=true#comments">Comments (42)</a></li>
  <li><a href="#" id="hide_work_skin_link">Hide Creator's Style</a></li>
  <li><noscript><a href="/somewhere">Noscript only</a></noscript></li>
</ul>`;

function fixtureNav(): HTMLElement {
  document.body.innerHTML = NAV_FIXTURE;

  const nav = document.querySelector<HTMLElement>("ul.work.navigation");

  if (!nav) throw new Error("fixture failed to render");

  return nav;
}

describe("collectNativeActions", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("adopts every recognizable control and skips noscript-only lis", () => {
    const actions = collectNativeActions(fixtureNav(), "999");

    expect(actions.map((action) => action.label)).toEqual([
      "Chapter Index",
      "Entire Work",
      "← Previous Chapter",
      "Share",
      "Download",
      "Subscribe",
      "Mark for Later",
      "Bookmark",
      "Comments (42)",
      "Hide Creator's Style",
    ]);
  });

  it("turns the chapter-index select into chapter links plus the full index", () => {
    const [index] = collectNativeActions(fixtureNav(), "999");

    if (index.kind !== "menu") throw new Error("expected a menu");

    expect(index.items).toEqual([
      { label: "1. The Beginning", href: "/works/999/chapters/101" },
      { label: "2. The Middle", href: "/works/999/chapters/102" },
      { label: "Full-page Index", href: "/works/999/navigate" },
    ]);
  });

  it("builds the download menu from the nested format links", () => {
    const actions = collectNativeActions(fixtureNav(), "999");
    const download = actions.find((action) => action.label === "Download");

    if (download?.kind !== "menu") throw new Error("expected a menu");

    expect(download.items).toEqual([
      { label: "EPUB", href: "/downloads/999/work.epub" },
      { label: "PDF", href: "/downloads/999/work.pdf" },
    ]);
  });

  it("keeps real hrefs on links and drops them for hash anchors", () => {
    const actions = collectNativeActions(fixtureNav(), "999");
    const entire = actions.find((action) => action.label === "Entire Work");
    const styleToggle = actions.find(
      (action) => action.label === "Hide Creator's Style",
    );

    if (entire?.kind !== "action" || styleToggle?.kind !== "action") {
      throw new Error("expected plain actions");
    }

    expect(entire.href).toBe("/works/999?view_full_work=true");
    expect(styleToggle.href).toBeNull();
  });

  it("proxies form submits and fires the original input", () => {
    const nav = fixtureNav();
    const actions = collectNativeActions(nav, "999");
    const subscribe = actions.find((action) => action.label === "Subscribe");

    if (subscribe?.kind !== "action") throw new Error("expected an action");

    expect(subscribe.href).toBeNull();

    let clicked = false;
    nav
      .querySelector<HTMLInputElement>('li.subscribe input[type="submit"]')
      ?.addEventListener("click", (event) => {
        event.preventDefault();
        clicked = true;
      });
    subscribe.activate();

    expect(clicked).toBe(true);
  });

  it("returns nothing for an empty or unrecognizable list", () => {
    document.body.innerHTML = `<ul class="work navigation actions"><li><span>text</span></li></ul>`;

    const nav = document.querySelector<HTMLElement>("ul.work.navigation");

    if (!nav) throw new Error("fixture failed");

    expect(collectNativeActions(nav, "999")).toEqual([]);
  });
});

// Mirrors otwarchive's _feedback partial actions row: back-to-top link,
// chapter links, kudos form, and the comments toggle.
const FEEDBACK_FIXTURE = `
<ul class="actions">
  <li><a href="#main">↑ Top</a></li>
  <li class="chapter previous"><a href="/works/999/chapters/101">← Previous Chapter</a></li>
  <li class="chapter next"><a href="/works/999/chapters/103">Next Chapter →</a></li>
  <li>
    <form id="new_kudo" action="/kudos" method="post">
      <input type="hidden" name="kudo[commentable_id]" value="999" />
      <input type="submit" name="commit" value="Kudos ♥" id="kudo_submit" />
    </form>
  </li>
  <li class="comments" id="show_comments_link_bottom"><a href="/works/999?show_comments=true#comments">Comments (42)</a></li>
</ul>`;

describe("collectFeedbackActions", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  function fixtureRow(): HTMLElement {
    document.body.innerHTML = FEEDBACK_FIXTURE;

    const row = document.querySelector<HTMLElement>("ul.actions");

    if (!row) throw new Error("fixture failed to render");

    return row;
  }

  it("adopts only the back-to-top link and the kudos form", () => {
    const actions = collectFeedbackActions(fixtureRow());

    expect(actions.map((action) => action.label)).toEqual([
      "↑ Top",
      "Kudos ♥",
    ]);
  });

  it("proxies the kudos submit to the original input", () => {
    const row = fixtureRow();
    const actions = collectFeedbackActions(row);
    const kudos = actions.find((action) => action.label === "Kudos ♥");

    if (kudos?.kind !== "action") throw new Error("expected an action");

    expect(kudos.href).toBeNull();

    let clicked = false;
    row
      .querySelector<HTMLInputElement>("#kudo_submit")
      ?.addEventListener("click", (event) => {
        event.preventDefault();
        clicked = true;
      });
    kudos.activate();

    expect(clicked).toBe(true);
  });

  it("keeps the top link a hash-free button that fires the original", () => {
    const row = fixtureRow();
    const actions = collectFeedbackActions(row);
    const top = actions.find((action) => action.label === "↑ Top");

    if (top?.kind !== "action") throw new Error("expected an action");

    expect(top.href).toBeNull();

    let clicked = false;
    row
      .querySelector<HTMLAnchorElement>('a[href="#main"]')
      ?.addEventListener("click", (event) => {
        event.preventDefault();
        clicked = true;
      });
    top.activate();

    expect(clicked).toBe(true);
  });
});

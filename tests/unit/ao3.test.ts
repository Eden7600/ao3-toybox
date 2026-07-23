import {
  canonicalAo3Url,
  extractWorkIdFromUrl,
  isAo3Url,
  isWorkPage,
  scrapeCurrentChapter,
} from "@src/common/ao3";
import type { DetachedWindowAPI } from "happy-dom";
import { beforeEach, describe, expect, it } from "vitest";

function setUrl(url: string): void {
  (window as unknown as { happyDOM: DetachedWindowAPI }).happyDOM.setURL(url);
}

beforeEach(() => {
  document.body.innerHTML = "";
  setUrl("https://archiveofourown.org/");
});

describe("isAo3Url", () => {
  it("matches AO3 domains and their subdomains", () => {
    expect(isAo3Url("https://archiveofourown.org/works/123")).toBe(true);
    expect(isAo3Url("http://www.archiveofourown.org/")).toBe(true);
    expect(isAo3Url("https://ao3.org/")).toBe(true);
    expect(isAo3Url("https://archive.transformativeworks.org/works")).toBe(
      true,
    );
  });

  it("rejects lookalike hosts that merely contain the domain", () => {
    expect(isAo3Url("https://archiveofourown.org.evil.com/")).toBe(false);
    expect(isAo3Url("https://evil.com/archiveofourown.org")).toBe(false);
    expect(isAo3Url("https://notarchiveofourown.org/")).toBe(false);
  });

  it("rejects missing and unparsable URLs", () => {
    expect(isAo3Url(undefined)).toBe(false);
    expect(isAo3Url("")).toBe(false);
    expect(isAo3Url("not a url")).toBe(false);
  });
});

describe("canonicalAo3Url", () => {
  it("maps alternative domains to archiveofourown.org, keeping path, query, and fragment", () => {
    expect(
      canonicalAo3Url(
        "https://archive.transformativeworks.org/works/123?view_adult=true#main",
      ),
    ).toBe("https://archiveofourown.org/works/123?view_adult=true#main");
    expect(canonicalAo3Url("https://ao3.org/tags/Fluff/works")).toBe(
      "https://archiveofourown.org/tags/Fluff/works",
    );
    expect(canonicalAo3Url("https://archiveofourown.com/")).toBe(
      "https://archiveofourown.org/",
    );
    expect(canonicalAo3Url("https://archiveofourown.net/works")).toBe(
      "https://archiveofourown.org/works",
    );
  });

  it("maps subdomains of alternative domains and forces https", () => {
    expect(canonicalAo3Url("http://www.ao3.org/works/123")).toBe(
      "https://archiveofourown.org/works/123",
    );
  });

  it("leaves the canonical domain and its subdomains alone", () => {
    expect(canonicalAo3Url("https://archiveofourown.org/works/123")).toBe(null);
    expect(canonicalAo3Url("https://www.archiveofourown.org/")).toBe(null);
  });

  it("ignores non-AO3 hosts, lookalikes, and unparsable URLs", () => {
    expect(canonicalAo3Url("https://example.com/works/123")).toBe(null);
    expect(canonicalAo3Url("https://ao3.org.evil.com/")).toBe(null);
    expect(canonicalAo3Url("https://notao3.org/")).toBe(null);
    expect(canonicalAo3Url("not a url")).toBe(null);
    expect(canonicalAo3Url("")).toBe(null);
  });
});

describe("isWorkPage", () => {
  it("matches work and chapter pages", () => {
    setUrl("https://archiveofourown.org/works/12345");
    expect(isWorkPage()).toBe(true);

    setUrl("https://archiveofourown.org/works/12345/chapters/67890");
    expect(isWorkPage()).toBe(true);

    setUrl("https://archiveofourown.org/works/12345?view_adult=true");
    expect(isWorkPage()).toBe(true);
  });

  it("rejects listings and other pages", () => {
    setUrl("https://archiveofourown.org/works");
    expect(isWorkPage()).toBe(false);

    setUrl("https://archiveofourown.org/tags/Fluff/works");
    expect(isWorkPage()).toBe(false);

    setUrl("https://archiveofourown.org/works/12345/bookmarks");
    expect(isWorkPage()).toBe(false);
  });
});

describe("extractWorkIdFromUrl", () => {
  it("extracts the id from work and chapter urls", () => {
    setUrl("https://archiveofourown.org/works/12345");
    expect(extractWorkIdFromUrl()).toBe("12345");

    setUrl("https://archiveofourown.org/works/12345/chapters/67890");
    expect(extractWorkIdFromUrl()).toBe("12345");
  });

  it("returns null off work pages", () => {
    setUrl("https://archiveofourown.org/tags/Fluff/works");
    expect(extractWorkIdFromUrl()).toBeNull();
  });
});

describe("scrapeCurrentChapter", () => {
  it("reads the chapter number from the chapter heading", () => {
    setUrl("https://archiveofourown.org/works/12345/chapters/67890");
    document.body.innerHTML = `
      <div class="chapter">
        <h3 class="title">
          <a href="/works/12345/chapters/67890">Chapter 17</a>: The Reckoning
        </h3>
      </div>`;

    expect(scrapeCurrentChapter()).toBe(17);
  });

  it("returns null when viewing the full work", () => {
    setUrl("https://archiveofourown.org/works/12345?view_full_work=true");
    document.body.innerHTML = `
      <h3 class="title"><a href="/works/12345/chapters/67890">Chapter 1</a></h3>`;

    expect(scrapeCurrentChapter()).toBeNull();
  });

  it("falls back to chapter 1 on chapter urls without a numbered heading", () => {
    setUrl("https://archiveofourown.org/works/12345/chapters/67890");
    document.body.innerHTML = `
      <h3 class="title"><a href="/works/12345/chapters/67890">An Unnumbered Interlude</a></h3>`;

    expect(scrapeCurrentChapter()).toBe(1);
  });

  it("returns 1 on single-chapter works", () => {
    setUrl("https://archiveofourown.org/works/12345");
    document.body.innerHTML = `
      <div id="chapters" class="userstuff module">
        <p>The entire work, no chapter wrappers.</p>
      </div>`;

    expect(scrapeCurrentChapter()).toBe(1);
  });

  it("returns null on a multi-chapter main page without a chapter heading", () => {
    setUrl("https://archiveofourown.org/works/12345");
    document.body.innerHTML = `
      <div id="chapters">
        <div class="chapter" id="chapter-1">
          <div class="userstuff"><p>Chapter text without a heading.</p></div>
        </div>
      </div>`;

    expect(scrapeCurrentChapter()).toBeNull();
  });

  it("returns null when the page has no chapter structure at all", () => {
    setUrl("https://archiveofourown.org/works/12345");

    expect(scrapeCurrentChapter()).toBeNull();
  });
});

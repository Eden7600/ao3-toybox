<script setup lang="ts">
import { prepareCss } from "@src/ao3_theme_injector/prepare-css";
import {
  formatKudosPerHit,
  formatRatio,
  kudosPerHitRatio,
  parseStatNumber,
  STACKED_STATS_CSS,
  wordsPerChapterRatio,
} from "@src/common/blurb-stats";
import { Color } from "@src/common/color";
import {
  COMPLETED_TEXT_COLOR,
  DATE_TEXT_KEYFRAMES,
  dateBadgeStyle,
  interpolateColor,
  naturalDateLabel,
  type DateBadgeStyle,
} from "@src/common/date-badge";
import {
  finishReadingAt,
  formatFinishAt,
  formatReadingTime,
  readingMinutes,
} from "@src/common/reading-time";
import type { Settings } from "@src/common/settings";
import { cleanTagName } from "@src/common/tag-cleaning";
import {
  averageTagColor,
  countTagColors,
  formatColorCounts,
} from "@src/common/tag-color-summary";
import blurbCardCssSource from "@src/content/styles/blurb-card.scss?inline";
import tagColorSummaryCssSource from "@src/content/styles/tag-color-summary.css?inline";
import blurbCss from "@src/options_ui/assets/ao3-blurb.css?inline";
import imagesetUrl from "@src/options_ui/assets/ao3-imageset.png";
import { computed, ref } from "vue";

// srcdoc documents inherit the parent's base URL, but resolve the sprite
// against this page explicitly so the reference is unambiguous.
const absoluteImagesetUrl = new URL(imagesetUrl, document.baseURI).href;
const coreCss = blurbCss.replaceAll("__AO3_IMAGESET__", absoluteImagesetUrl);

const props = defineProps<{ settings: Settings }>();

type SampleWork = {
  title: string;
  author: string;
  fandoms: string[];
  symbols: {
    rating: string;
    warning: string;
    category: string;
    complete: string;
  };
  symbolTitles: string[];
  daysAgo: number;
  warningsTags: string[];
  relationshipTags: string[];
  characterTags: string[];
  freeformTags: string[];
  summary: string;
  series: { position: number; name: string } | null;
  language: string;
  words: string;
  chaptersPublished: number;
  chaptersTotal: number | null;
  collections: string;
  comments: string;
  kudos: string;
  bookmarks: string;
  hits: string;
  // Illustrative resolved highlight colors for the tag summary stat —
  // the preview has no real tag config to resolve against.
  highlightedTagColors: string[];
};

// Tags deliberately include fandom discriminators and "- Freeform"/"- Fandom"
// suffixes so the tag-cleaning toggles visibly change the preview.
const SAMPLE_WORKS: SampleWork[] = [
  {
    title: "Man in the Mirror",
    author: "LuckyLadybug",
    fandoms: ["Final Fantasy VII (Video Game 1997)"],
    symbols: {
      rating: "rating-teen rating",
      warning: "warning-no warnings",
      category: "category-gen category",
      complete: "complete-yes iswip",
    },
    symbolTitles: [
      "Teen And Up Audiences",
      "No Archive Warnings Apply",
      "Gen",
      "Complete Work",
    ],
    daysAgo: 14,
    warningsTags: ["No Archive Warnings Apply"],
    relationshipTags: ["Sephiroth & Cloud Strife"],
    characterTags: ["Cloud Strife", "Sephiroth (Compilation of FFVII)"],
    freeformTags: ["Angst - Freeform", "Hurt/Comfort", "Friendship"],
    summary:
      "Cloud is finally attempting to see what else his Jenova cells can do. A shapeshifting accident tips his emotions out of control, and everyone spreads out looking for him as Sephiroth tries desperately to find and connect with him.",
    series: { position: 7, name: "Twilight and Dawn Book II" },
    language: "English",
    words: "4,957",
    chaptersPublished: 1,
    chaptersTotal: 1,
    collections: "2",
    comments: "6",
    kudos: "42",
    bookmarks: "11",
    hits: "890",
    highlightedTagColors: ["green", "blue"],
  },
  {
    title: "The Long Road Home",
    author: "wanderingscribe",
    fandoms: ["Sherlock Holmes & Related Fandoms - Fandom"],
    symbols: {
      rating: "rating-mature rating",
      warning: "warning-choosenotto warnings",
      category: "category-slash category",
      complete: "complete-no iswip",
    },
    symbolTitles: [
      "Mature",
      "Creator Chose Not To Use Archive Warnings",
      "M/M",
      "Work in Progress",
    ],
    daysAgo: 620,
    warningsTags: ["Creator Chose Not To Use Archive Warnings"],
    relationshipTags: ["Sherlock Holmes/John Watson"],
    characterTags: ["Sherlock Holmes", "John Watson (Sherlock Holmes)"],
    freeformTags: ["Slow Burn", "Enemies to Lovers (eventual)", "Case Fic"],
    summary:
      "A years-long case drags the pair across the continent, and neither of them is willing to say what everyone else already knows.",
    series: null,
    language: "English",
    words: "87,231",
    chaptersPublished: 12,
    chaptersTotal: null,
    collections: "9",
    comments: "148",
    kudos: "1,204",
    bookmarks: "327",
    hits: "35,671",
    highlightedTagColors: ["red", "red", "purple"],
  },
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(daysAgo: number): string {
  const date = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function badgeStyleAttr(style: DateBadgeStyle): string {
  const parts = [
    `color: ${style.color}`,
    style.backgroundColor ? `background-color: ${style.backgroundColor}` : "",
    `padding: ${style.padding}`,
    `border-radius: ${style.borderRadius}`,
    `border: ${style.border}`,
    `font-weight: ${style.fontWeight}`,
  ].filter(Boolean);

  return parts.join("; ");
}

// Mirrors the date-formatter content script's decisions exactly
function datetimeHtml(work: SampleWork, settings: Settings): string {
  const plainDate = formatDate(work.daysAgo);
  const scriptActive =
    settings.enableDateBadge || settings.enableDateNaturalLanguage;

  if (!scriptActive) {
    return `<p class="datetime">${escapeHtml(plainDate)}</p>`;
  }

  const completed = work.chaptersPublished === work.chaptersTotal;
  let text = settings.enableDateNaturalLanguage
    ? naturalDateLabel(work.daysAgo)
    : plainDate;
  let style: DateBadgeStyle | null = null;

  if (settings.enableDateBadge) {
    style = dateBadgeStyle(
      interpolateColor(DATE_TEXT_KEYFRAMES, work.daysAgo),
      settings.ao3ThemeOled,
    );
  }

  if (completed) {
    if (settings.enableDateBadge) {
      style = dateBadgeStyle(COMPLETED_TEXT_COLOR, settings.ao3ThemeOled);
    }

    if (settings.showCompletedText) {
      text = "Completed";
    }
  }

  const styleAttr = style ? ` style="${badgeStyleAttr(style)}"` : "";

  return `<p class="datetime"${styleAttr}>${escapeHtml(text)}</p>`;
}

function tagHtml(name: string, settings: Settings): string {
  const label = cleanTagName(name, {
    removeFandomDiscriminator: settings.removeFandomDiscriminator,
    removeTagSuffixes: settings.removeTagSuffixes,
  });

  return `<a class="tag" href="#">${escapeHtml(label)}</a>`;
}

function tagListHtml(work: SampleWork, settings: Settings): string {
  const items = [
    ...work.warningsTags.map(
      (tag) =>
        `<li class="warnings"><strong>${tagHtml(tag, settings)}</strong></li>`,
    ),
    ...work.relationshipTags.map(
      (tag) => `<li class="relationships">${tagHtml(tag, settings)}</li>`,
    ),
    ...work.characterTags.map(
      (tag) => `<li class="characters">${tagHtml(tag, settings)}</li>`,
    ),
    ...work.freeformTags.map(
      (tag) => `<li class="freeforms">${tagHtml(tag, settings)}</li>`,
    ),
  ];

  return `<ul class="tags commas">${items.join("")}</ul>`;
}

// Mirrors the hide-stat-lines and ratio-stats content scripts
function statsHtml(work: SampleWork, settings: Settings): string {
  const chapters = `${String(work.chaptersPublished)}/${work.chaptersTotal === null ? "?" : String(work.chaptersTotal)}`;

  const language = settings.hideBlurbLanguageLine
    ? ""
    : `<dt class="language">Language:</dt><dd class="language">${escapeHtml(work.language)}</dd>`;

  const extras: string[] = [];
  const kudosPerHit = kudosPerHitRatio(
    parseStatNumber(work.kudos),
    parseStatNumber(work.hits),
  );
  const wordsPerChapter = wordsPerChapterRatio(
    parseStatNumber(work.words),
    work.chaptersPublished,
  );

  if (settings.showKudosPerHitRatio && kudosPerHit !== null) {
    extras.push(
      `<dt class="toybox-stat toybox-kudos-hits">Kudos/Hits:</dt><dd class="toybox-stat toybox-kudos-hits">${formatKudosPerHit(kudosPerHit)}</dd>`,
    );
  }

  if (settings.showWordsPerChapterRatio && wordsPerChapter !== null) {
    extras.push(
      `<dt class="toybox-stat toybox-words-chapter">Words/Chapter:</dt><dd class="toybox-stat toybox-words-chapter">${formatRatio(wordsPerChapter, 0)}</dd>`,
    );
  }

  // Mirrors the ratio-stats reading-time injections
  const minutes = readingMinutes(
    parseStatNumber(work.words),
    settings.readingWpm,
  );

  if (settings.showBlurbReadingTime && minutes !== null) {
    extras.push(
      `<dt class="toybox-stat toybox-reading-time">Reading Time:</dt><dd class="toybox-stat toybox-reading-time">${formatReadingTime(minutes)}</dd>`,
    );
  }

  if (settings.showBlurbFinishAt && minutes !== null) {
    const now = new Date();

    extras.push(
      `<dt class="toybox-stat toybox-finish-at">Finish At:</dt><dd class="toybox-stat toybox-finish-at">${escapeHtml(formatFinishAt(finishReadingAt(now, minutes), now))}</dd>`,
    );
  }

  // Mirrors the tag-highlighter's highlight summary stat
  if (settings.showTagColorSummary) {
    const highlightCounts = countTagColors(work.highlightedTagColors);

    if (highlightCounts.size > 0) {
      const style = settings.tagColorSummaryStyle;
      const chips =
        style === "swatch"
          ? ""
          : [...highlightCounts.entries()]
              .map(
                ([color, count]) =>
                  `<span class="toybox-tag-color-chip" style="background-color: ${Color.getBackgroundColor(color)}; color: ${Color.getForegroundColor(color)}">${String(count)}</span>`,
              )
              .join("");
      const swatch =
        style === "chips"
          ? ""
          : `<span class="toybox-tag-color-swatch" style="background-color: ${averageTagColor(highlightCounts) ?? ""}" title="${formatColorCounts(highlightCounts)}"></span>`;

      extras.push(
        `<dt class="toybox-stat toybox-tag-colors">Highlights:</dt><dd class="toybox-stat toybox-tag-colors">${chips}${swatch}</dd>`,
      );
    }
  }

  const collections = settings.hideBlurbCollectionsCount
    ? ""
    : `<dt class="collections">Collections:</dt><dd class="collections">${escapeHtml(work.collections)}</dd>`;

  const comments = settings.hideBlurbCommentsCount
    ? ""
    : `<dt class="comments">Comments:</dt><dd class="comments">${escapeHtml(work.comments)}</dd>`;

  const bookmarks = settings.hideBlurbBookmarksCount
    ? ""
    : `<dt class="bookmarks">Bookmarks:</dt><dd class="bookmarks">${escapeHtml(work.bookmarks)}</dd>`;

  return `<dl class="stats">
        ${language}
        <dt class="words">Words:</dt><dd class="words">${escapeHtml(work.words)}</dd>
        <dt class="chapters">Chapters:</dt><dd class="chapters">${chapters}</dd>
        ${collections}
        ${comments}
        <dt class="kudos">Kudos:</dt><dd class="kudos">${escapeHtml(work.kudos)}</dd>
        ${bookmarks}
        <dt class="hits">Hits:</dt><dd class="hits">${escapeHtml(work.hits)}</dd>
        ${extras.join("\n        ")}
      </dl>`;
}

function blurbHtml(work: SampleWork, settings: Settings): string {
  const symbols = [
    { cls: work.symbols.rating, title: work.symbolTitles[0] },
    { cls: work.symbols.warning, title: work.symbolTitles[1] },
    { cls: work.symbols.category, title: work.symbolTitles[2] },
    { cls: work.symbols.complete, title: work.symbolTitles[3] },
  ]
    .map(
      (symbol) =>
        `<li><span class="${symbol.cls}" title="${escapeHtml(symbol.title)}"><span class="text">${escapeHtml(symbol.title)}</span></span></li>`,
    )
    .join("");

  const fandoms = work.fandoms
    .map((fandom) => tagHtml(fandom, settings))
    .join(", ");

  const series = work.series
    ? `<h6 class="landmark heading">Series</h6>
       <ul class="series"><li>Part <strong>${String(work.series.position)}</strong> of <a href="#">${escapeHtml(work.series.name)}</a></li></ul>`
    : "";

  return `
    <li class="work blurb group" role="article">
      <div class="header module">
        <h4 class="heading">
          <a href="#">${escapeHtml(work.title)}</a> by
          <a href="#" rel="author">${escapeHtml(work.author)}</a>
        </h4>
        <h5 class="fandoms heading"><span class="landmark">Fandoms:</span> ${fandoms}</h5>
        <ul class="required-tags">${symbols}</ul>
        ${datetimeHtml(work, settings)}
      </div>
      <h6 class="landmark heading">Tags</h6>
      ${tagListHtml(work, settings)}
      <h6 class="landmark heading">Summary</h6>
      <blockquote class="userstuff summary"><p>${escapeHtml(work.summary)}</p></blockquote>
      ${series}
      ${statsHtml(work, settings)}
    </li>`;
}

const srcdoc = computed(() => {
  const blurbs = SAMPLE_WORKS.map((work) =>
    blurbHtml(work, props.settings),
  ).join("");
  // The theme injector always runs on AO3; prepareCss mirrors its output
  // for the current theme settings (nothing when the theme is off — the
  // page keeps AO3's default skin and card fallbacks apply).
  const themeCss = prepareCss({
    enableTheme: props.settings.ao3ThemeEnabled,
    enableOled: props.settings.ao3ThemeOled,
    family: props.settings.ao3ThemeFamily,
    accent: props.settings.ao3ThemeAccent,
    flavor: props.settings.ao3ThemeFlavor,
    catppuccinAccent: props.settings.ao3ThemeCatppuccinAccent,
  });

  // Mirrors the stat-layout content script
  const statLayoutCss = props.settings.stackBlurbStats ? STACKED_STATS_CSS : "";

  // Mirrors the blurb-card content script
  const blurbCardCss = props.settings.enableModernBlurbs
    ? blurbCardCssSource
    : "";

  // Mirrors the tag-highlighter's summary style injection
  const tagColorSummaryCss = props.settings.showTagColorSummary
    ? tagColorSummaryCssSource
    : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>${coreCss}</style>
<style>${themeCss}</style>
<style>${statLayoutCss}</style>
<style>${blurbCardCss}</style>
<style>${tagColorSummaryCss}</style>
</head>
<body>
<div id="outer" class="wrapper">
  <div id="inner" class="wrapper">
    <div id="main" class="works-index region">
      <ol class="work index group">${blurbs}</ol>
    </div>
  </div>
</div>
</body>
</html>`;
});

const frame = ref<HTMLIFrameElement | null>(null);
const frameHeight = ref(420);

const onFrameLoad = () => {
  const doc = frame.value?.contentDocument;

  if (doc) {
    frameHeight.value = doc.body.scrollHeight + 16;
  }
};
</script>

<template>
  <iframe
    ref="frame"
    :srcdoc="srcdoc"
    :style="{ height: `${frameHeight}px` }"
    class="w-full bg-white"
    sandbox="allow-same-origin"
    title="Work blurb preview"
    @load="onFrameLoad"
  ></iframe>
</template>

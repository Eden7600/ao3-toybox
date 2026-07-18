import { Color } from "@src/common/color";
import {
  progressBarFillBackground,
  progressBarGeometry,
  progressBarHidden,
  progressBarLabelText,
  remainingReadingMinutes,
  type ProgressBarGeometry,
} from "@src/common/progress-bar";
import { countWords } from "@src/common/reading-time";
import { render } from "preact";
import { ContentScript } from "../content-script";

const ROOT_ID = "toybox-progress-bar-root";
const LABEL_ID = "toybox-progress-bar-label";

/** Document-coordinate span the bar measures progress against. */
type ScopeBounds = { start: number; height: number; element: HTMLElement };

const STYLE_CONSTANTS = {
  bar: {
    transform: "transform 0.5s ease-in-out",
  },
  colors: {
    base: Color.tailwind.slate[200],
    marker: Color.tailwind.slate[500],
  },
  opacity: {
    background: "0.25",
    marker: "0.7",
  },
} as const;

export default class ProgressBar extends ContentScript {
  private chaptersContainer: HTMLElement | null = null;
  private chapters: HTMLElement[] = [];
  private hasMultipleChapters = false;
  private chapterMarkers: number[] = [];
  private geometry: ProgressBarGeometry = progressBarGeometry("top");
  private readonly scopeWordCounts = new WeakMap<HTMLElement, number>();

  // Stable references so a live settings reset can detach them
  private readonly onScroll = (): void => {
    this.handleScroll();
  };

  getEnabled(): boolean {
    const hasWorksInUrl = window.location.pathname.includes("/works/");
    const hasWorkIdInUrl = /\/works\/(\d+)/.exec(window.location.pathname);

    return (
      hasWorksInUrl &&
      Boolean(hasWorkIdInUrl) &&
      this.settings.enableProgressBar
    );
  }

  override get supportsLiveReapply(): boolean {
    return true;
  }

  /** Tear the bar out entirely; onProcess rebuilds it from settings. */
  async onSettingsReset(): Promise<void> {
    window.removeEventListener("scroll", this.onScroll);
    document.getElementById(ROOT_ID)?.remove();
    this.chaptersContainer = null;
    this.chapters = [];
    this.hasMultipleChapters = false;
    this.chapterMarkers = [];
  }

  async onProcess(): Promise<void> {
    this.geometry = progressBarGeometry(
      this.settings.progressBarPosition,
      this.settings.progressBarThickness,
      this.settings.progressBarOffset,
    );

    const validator = document.querySelector(
      "div#workskin>div#chapters>div.chapter",
    );
    this.chaptersContainer = document.querySelector("div#chapters");

    if (validator && this.chaptersContainer) {
      this.chapters = Array.from(
        this.chaptersContainer.querySelectorAll<HTMLElement>(
          "div#chapters>div.chapter",
        ),
      );

      if (this.chapters.length > 1) {
        this.hasMultipleChapters = true;
        this.calculateChapterMarkers();
      }
    }

    this.injectProgressBar();
  }

  private get showChapterMarkers(): boolean {
    // Markers describe work-level chapter boundaries; a chapter-scoped
    // bar restarts at each chapter and they would be meaningless
    return (
      this.hasMultipleChapters &&
      this.settings.progressBarShowChapterMarkers &&
      this.settings.progressBarScope === "work"
    );
  }

  private calculateChapterMarkers(): void {
    if (!this.chaptersContainer) return;

    const totalHeight = this.chaptersContainer.offsetHeight;
    let accumulatedHeight = 0;

    for (let i = 0; i < this.chapters.length - 1; i++) {
      accumulatedHeight += this.chapters[i].offsetHeight;
      this.chapterMarkers.push((accumulatedHeight / totalHeight) * 100);
    }
  }

  private injectProgressBar(): void {
    const container = document.createElement("div");
    container.id = ROOT_ID;
    document.body.appendChild(container);

    render(this.renderProgressBarUI(), container);

    window.addEventListener("scroll", this.onScroll);

    // Paint the initial state so a mid-page load (restored scroll
    // position) starts correct instead of waiting for the first scroll
    this.handleScroll();
  }

  private renderProgressBarUI() {
    return (
      <div style={{ position: "relative" }}>
        {/* Main progress container (also the click-to-seek hit area) */}
        {this.renderProgressBarContainer()}

        {/* Progress indicator */}
        {this.renderProgressIndicator()}

        {/* Chapter markers */}
        {this.showChapterMarkers && this.renderChapterMarkers()}

        {/* Floating progress label */}
        {this.settings.progressBarLabelMode !== "none" && this.renderLabel()}
      </div>
    );
  }

  private renderProgressBarContainer() {
    const seek = this.settings.progressBarClickToSeek;

    return (
      <div
        style={{
          position: "fixed",
          ...this.geometry.anchor,
          backgroundColor: STYLE_CONSTANTS.colors.base,
          opacity: STYLE_CONSTANTS.opacity.background,
          zIndex: "999",
          transition: STYLE_CONSTANTS.bar.transform,
          transform: this.geometry.offscreenTransform,
          pointerEvents: seek ? "auto" : "none",
          cursor: seek ? "pointer" : "default",
        }}
        id="progressBarContainer"
        onClick={seek ? this.onTrackClick : undefined}
      />
    );
  }

  private renderProgressIndicator() {
    // The fill grows along the reading axis from the track's start edge
    return (
      <div
        id="progressBar"
        style={{
          position: "fixed",
          ...this.geometry.anchor,
          [this.geometry.fillProperty]: "0%",
          background: progressBarFillBackground(
            this.settings.progressBarStyle,
            this.geometry.gradientDirection,
            this.settings.progressBarColor,
          ),
          zIndex: "1000",
          transition: `${this.geometry.fillProperty} 0.1s, ${STYLE_CONSTANTS.bar.transform}`,
          transform: this.geometry.offscreenTransform,
          pointerEvents: "none",
        }}
      />
    );
  }

  private renderChapterMarkers() {
    const thickness = `${String(this.settings.progressBarThickness)}px`;

    return this.chapterMarkers.map((position) => (
      <div
        key={position}
        role="presentation"
        style={{
          position: "fixed",
          ...this.geometry.anchor,
          [this.geometry.fillProperty]: thickness,
          [this.geometry.markerOffsetProperty]: `${String(position)}%`,
          [this.geometry.markerBorderProperty]:
            `2px solid ${STYLE_CONSTANTS.colors.marker}`,
          opacity: STYLE_CONSTANTS.opacity.marker,
          backgroundColor: "rgba(0,0,0,0)",
          zIndex: "1001",
          transition: STYLE_CONSTANTS.bar.transform,
          transform: this.geometry.offscreenTransform,
          pointerEvents: "none",
        }}
        id={`chapterMarker-${String(position)}`}
      />
    ));
  }

  private renderLabel() {
    // Rides the fill tip; handleScroll positions it and sets its text
    return (
      <div
        id={LABEL_ID}
        style={{
          position: "fixed",
          ...this.geometry.labelAnchor,
          [this.geometry.markerOffsetProperty]: "0%",
          transform: this.geometry.labelCenterTransform,
          zIndex: "1002",
          padding: "1px 8px",
          borderRadius: "999px",
          fontSize: "11px",
          lineHeight: "1.6",
          whiteSpace: "nowrap",
          background: "var(--box-background-color, rgba(255,255,255,0.92))",
          color: "var(--text-color, #333)",
          border: "1px solid var(--box-border-color-subtle, #ccc)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          pointerEvents: "none",
          visibility: "hidden",
        }}
      />
    );
  }

  private handleScroll(): void {
    const bounds = this.getScopeBounds();

    if (!bounds) return;

    const progress = this.measureProgress(bounds);
    this.updateProgressBar(progress);
    this.updateLabel(progress, bounds);
  }

  /**
   * The span progress is measured against: the whole chapters container,
   * or — in chapter scope — the chapter the reader is currently in (the
   * last one whose top has crossed the viewport bottom).
   */
  private getScopeBounds(): ScopeBounds | null {
    if (!this.chaptersContainer) return null;

    let element: HTMLElement = this.chaptersContainer;

    if (this.settings.progressBarScope === "chapter" && this.chapters.length) {
      const scrollBottom = window.scrollY + window.innerHeight;
      element = this.chapters[0];

      for (const chapter of this.chapters) {
        if (
          chapter.getBoundingClientRect().top + window.scrollY <
          scrollBottom
        ) {
          element = chapter;
        }
      }
    }

    return {
      start: element.getBoundingClientRect().top + window.scrollY,
      height: element.offsetHeight,
      element,
    };
  }

  private measureProgress(bounds: ScopeBounds): number {
    const scrollBottom = window.scrollY + window.innerHeight;

    if (scrollBottom <= bounds.start || bounds.height <= 0) {
      return 0;
    }

    return ((scrollBottom - bounds.start) / bounds.height) * 100;
  }

  private updateProgressBar(progress: number): void {
    const progressBar = document.getElementById("progressBar");
    const progressBarContainer = document.getElementById(
      "progressBarContainer",
    );

    if (progressBar) {
      const clamped = Math.min(Math.max(progress, 0), 100);
      progressBar.style[this.geometry.fillProperty] = `${String(clamped)}%`;
      progressBar.style.transform = this.getTransformStyle(progress);
    }

    if (progressBarContainer) {
      progressBarContainer.style.transform = this.getTransformStyle(progress);
    }

    if (this.showChapterMarkers) {
      this.updateChapterMarkers(progress);
    }
  }

  private updateLabel(progress: number, bounds: ScopeBounds): void {
    const label = document.getElementById(LABEL_ID);

    if (!label) return;

    if (progressBarHidden(progress, window.scrollY)) {
      label.style.visibility = "hidden";

      return;
    }

    const text = progressBarLabelText(
      this.settings.progressBarLabelMode,
      progress,
      remainingReadingMinutes(
        this.scopeWords(bounds.element),
        progress,
        this.settings.readingWpm,
      ),
    );

    if (text === "") {
      label.style.visibility = "hidden";

      return;
    }

    // Keep the pill inside the viewport near the bar's ends
    const clamped = Math.min(Math.max(progress, 3), 97);
    label.textContent = text;
    label.style[this.geometry.markerOffsetProperty] = `${String(clamped)}%`;
    label.style.visibility = "visible";
  }

  /** Word count of the measured span, cached per element. */
  private scopeWords(element: HTMLElement): number {
    let words = this.scopeWordCounts.get(element);

    if (words === undefined) {
      words = countWords(element.textContent);
      this.scopeWordCounts.set(element, words);
    }

    return words;
  }

  private readonly onTrackClick = (event: MouseEvent): void => {
    const bounds = this.getScopeBounds();

    if (!bounds) return;

    const fraction = this.geometry.horizontal
      ? event.clientX / window.innerWidth
      : event.clientY / window.innerHeight;

    // Inverse of measureProgress: put the viewport bottom at the clicked
    // fraction of the measured span
    const target = bounds.start + fraction * bounds.height - window.innerHeight;

    window.scrollTo({ top: Math.max(target, 0), behavior: "smooth" });
  };

  private updateChapterMarkers(progress: number): void {
    this.chapterMarkers.forEach((position) => {
      const marker = document.getElementById(
        `chapterMarker-${String(position)}`,
      );

      if (marker) {
        marker.style.transform = this.getTransformStyle(progress);
      }
    });
  }

  private getTransformStyle(progress: number): string {
    return progressBarHidden(progress, window.scrollY)
      ? this.geometry.offscreenTransform
      : "translate(0)";
  }
}

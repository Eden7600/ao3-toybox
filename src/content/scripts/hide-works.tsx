import {
  getHideReasons,
  getHideSources,
  isWorkHideExempt,
  resolveHideMode,
  restoreExemptWork,
} from "@src/common/hide-modes";
import { render } from "preact";
import { useState } from "preact/hooks";
import { ContentScript } from "../content-script";
import { createShadowHost } from "../shadow-host";
import hideWorksStyles from "../styles/hide-works.css?inline";
import rtBaseStyles from "../styles/rt-base.css?inline";

const EyeIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

const EyeOffIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
  </svg>
);

type HiddenWorkPlaceholderProps = {
  workElement: HTMLElement;
  reasons: string[];
  maxReasonsToShow: number;
};

const HiddenWorkPlaceholder = ({
  workElement,
  reasons,
  maxReasonsToShow,
}: HiddenWorkPlaceholderProps) => {
  const [revealed, setRevealed] = useState(false);

  const toggleVisibility = () => {
    const next = !revealed;
    setRevealed(next);
    workElement.style.display = next ? "" : "none";
  };

  const displayReasons = reasons.slice(0, maxReasonsToShow);
  const hiddenCount = reasons.length - maxReasonsToShow;
  const summary =
    reasons.length === 1
      ? `Hidden: ${reasons[0]}`
      : `Hidden for ${String(reasons.length)} reasons`;

  return (
    <div class="rt-hide-placeholder">
      <div class="rt-hide-bar">
        {revealed ? <EyeIcon /> : <EyeOffIcon />}
        <span class="rt-hide-summary" title={reasons.join("\n")}>
          {summary}
        </span>
        <button
          class="rt-hide-button"
          aria-expanded={revealed}
          onClick={toggleVisibility}
          title={revealed ? "Hide this work again" : "Show this work"}
        >
          {revealed ? "Re-hide" : "Show"}
        </button>
      </div>
      {reasons.length > 1 && (
        <ul class="rt-hide-reasons">
          {displayReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
          {hiddenCount > 0 && (
            <li>
              and {String(hiddenCount)} more reason
              {hiddenCount === 1 ? "" : "s"}
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default class HideWorks extends ContentScript {
  getEnabled(): boolean {
    // Master switch for the whole hiding system; per-source modes are
    // resolved per blurb in processMarkedWorks
    return this.settings.hideWorks;
  }

  async onProcess(): Promise<void> {
    this.processMarkedWorks();
  }

  async onMutation(): Promise<void> {
    // Blurbs can be marked after the process phase (e.g. once the listing
    // status fetch resolves); re-process whenever the page signals a change
    this.processMarkedWorks();
  }

  override get supportsLiveReapply(): boolean {
    return true;
  }

  /**
   * Live settings change: un-hide every processed work and drop its
   * placeholder so processMarkedWorks can re-resolve from scratch under
   * the new modes. Exempt pins ("exempt") are left alone — exemption is
   * decided by the async subscription status, not by these settings.
   */
  async onSettingsReset(): Promise<void> {
    document.querySelectorAll<HTMLElement>("li.work.blurb").forEach((work) => {
      if (work.dataset.toyboxHideProcessed !== "true") {
        return;
      }

      delete work.dataset.toyboxHideProcessed;
      work.style.display = "";

      const placeholder = work.previousElementSibling;

      if (
        placeholder instanceof HTMLElement &&
        placeholder.dataset.toyboxHideReason === "true"
      ) {
        placeholder.remove();
      }
    });
  }

  private processMarkedWorks(): void {
    // Find all works that have been marked for hiding
    const allWorks = document.querySelectorAll<HTMLElement>("li.work.blurb");
    const worksToHide: Array<{ element: HTMLElement; reasons: string[] }> = [];

    allWorks.forEach((work) => {
      const shouldHide = work.dataset.toyboxHide === "true";

      if (shouldHide) {
        const recorded = getHideReasons(work);
        const reasons = recorded.length > 0 ? recorded : ["Hidden work"];

        worksToHide.push({ element: work, reasons });
      }
    });

    if (worksToHide.length === 0) {
      return;
    }

    this.logger.log(`Hiding ${String(worksToHide.length)} works`);

    // Hide the works and inject reason placeholders
    worksToHide.forEach(({ element, reasons }) => {
      // Exempt works (subscribed, with the never-hide toggle on) are
      // skipped — or restored, when the async status arrived after a
      // filter already hid them
      if (isWorkHideExempt(element)) {
        if (restoreExemptWork(element)) {
          this.logger.log("Restored hide-exempt work");
        }

        return;
      }

      // Skip if this work has already been processed
      if (element.dataset.toyboxHideProcessed === "true") {
        return;
      }

      // Mark as processed
      element.dataset.toyboxHideProcessed = "true";

      const mode = resolveHideMode(
        getHideSources(element),
        this.settings.hideModes,
      );

      // Every contributing source says "don't hide" — leave it visible
      if (mode === "none") {
        return;
      }

      // Hide the work element
      element.style.display = "none";

      // Removed works disappear entirely, with no placeholder to expand
      if (mode === "remove") {
        return;
      }

      // Inject reason placeholder if configured
      if (this.settings.showHideReason) {
        const mountPoint = document.createElement("div");
        mountPoint.dataset.toyboxHideReason = "true";
        element.parentElement?.insertBefore(mountPoint, element);

        const { root } = createShadowHost({
          css: `${rtBaseStyles}\n${hideWorksStyles}`,
          hostStyle: "display: block; margin: 0.75em 0;",
          parent: mountPoint,
        });

        render(
          <HiddenWorkPlaceholder
            workElement={element}
            reasons={reasons}
            maxReasonsToShow={this.settings.maxHideReasonsToShow}
          />,
          root,
        );
      }
    });
  }
}

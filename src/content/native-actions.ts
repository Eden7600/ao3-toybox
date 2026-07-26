// Adopts AO3's native work-page controls into the Toybox toolbar. The
// classifier reads `ul.work.navigation.actions` (otwarchive's
// _work_header_navigation partial) and produces renderable actions that
// PROXY the original elements — AO3's own JS (share modal, subscribe AJAX,
// inline comments) keeps working because the hidden originals still
// receive the clicks.

export type NativeMenuItem = { label: string; href: string };

export type NativeAction =
  | {
      kind: "action";
      label: string;
      /** Real destination for middle/ctrl-click; null renders a button. */
      href: string | null;
      /** Fires the original element so AO3's JS handlers run. */
      activate: () => void;
    }
  | { kind: "menu"; label: string; items: NativeMenuItem[] };

function insideNoscript(element: Element): boolean {
  return element.closest("noscript") !== null;
}

function labelOf(element: Element): string {
  return element.textContent.replace(/\s+/g, " ").trim();
}

/**
 * Expandable li (Download, Chapter Index): the toggle's label plus the
 * nested links. The chapter-index select (select#selected_id of chapter
 * ids) becomes per-chapter links, with the full-page index appended so
 * the menu is never a dead end.
 */
function menuFromExpandable(
  li: HTMLLIElement,
  nested: HTMLUListElement,
  workId: string,
): NativeAction | null {
  const toggle = li.querySelector(":scope > button, :scope > a");
  const label = toggle && !insideNoscript(toggle) ? labelOf(toggle) : "";

  if (!label) {
    return null;
  }

  const items: NativeMenuItem[] = [];

  nested.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href") ?? "";

    if (!insideNoscript(anchor) && href && !href.startsWith("#")) {
      items.push({ label: labelOf(anchor), href });
    }
  });

  const chapterSelect = nested.querySelector<HTMLSelectElement>("select");

  if (chapterSelect) {
    for (const option of chapterSelect.options) {
      if (/^\d+$/.test(option.value)) {
        items.push({
          label: labelOf(option),
          href: `/works/${workId}/chapters/${option.value}`,
        });
      }
    }

    items.push({
      label: "Full-page Index",
      href: `/works/${workId}/navigate`,
    });
  }

  return items.length > 0 ? { kind: "menu", label, items } : null;
}

function actionFromLi(li: HTMLLIElement): NativeAction | null {
  const submit = li.querySelector<HTMLInputElement>(
    'form input[type="submit"]',
  );

  if (submit && !insideNoscript(submit)) {
    return {
      kind: "action",
      label: submit.value.trim(),
      href: null,
      activate() {
        submit.click();
      },
    };
  }

  const clickable = li.querySelector<HTMLElement>("a[href], button");

  if (!clickable || insideNoscript(clickable)) {
    return null;
  }

  const label = labelOf(clickable);

  if (!label) {
    return null;
  }

  const href = clickable.getAttribute("href");

  return {
    kind: "action",
    label,
    href: href && !href.startsWith("#") ? href : null,
    activate() {
      clickable.click();
    },
  };
}

/**
 * Bottom feedback actions (otwarchive's _feedback partial) the toolbar
 * doesn't already carry from the header navigation: the kudos form and
 * the back-to-top link. The list's chapter and comments lis duplicate
 * header-nav actions, so they are skipped — hiding the native list is
 * only safe when the header adoption succeeded and covers them.
 */
export function collectFeedbackActions(list: HTMLElement): NativeAction[] {
  const actions: NativeAction[] = [];

  list.querySelectorAll<HTMLLIElement>(":scope > li").forEach((li) => {
    const adoptable =
      li.querySelector('form input[type="submit"]') ??
      li.querySelector('a[href="#main"]');

    if (!adoptable || insideNoscript(adoptable)) {
      return;
    }

    const action = actionFromLi(li);

    if (action) {
      actions.push(action);
    }
  });

  return actions;
}

/**
 * Classifies every li of the native navigation list. Unrecognizable lis
 * are skipped; callers should only hide the native list when at least one
 * action was recovered.
 */
export function collectNativeActions(
  nav: HTMLElement,
  workId: string,
): NativeAction[] {
  const actions: NativeAction[] = [];

  nav.querySelectorAll<HTMLLIElement>(":scope > li").forEach((li) => {
    const nested = li.querySelector<HTMLUListElement>("ul");
    const action = nested
      ? menuFromExpandable(li, nested, workId)
      : actionFromLi(li);

    if (action) {
      actions.push(action);
    }
  });

  return actions;
}

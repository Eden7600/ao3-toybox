export type TagCleaningOptions = {
  removeFandomDiscriminator: boolean;
  removeTagSuffixes: boolean;
};

/**
 * Applies the tag-display cleanups to a tag name. Shared by the clean-tags
 * content script and the options-page blurb preview so they can't drift.
 */
export function cleanTagName(
  name: string,
  options: TagCleaningOptions,
): string {
  let cleaned = name;

  // Remove fandom discriminators: parentheticals at the end of the tag, or —
  // in relationship tags like "The Convict | Simon (Iron Lung)/Ryland Grace" —
  // at the end of any participant segment (before a "/" or " & " separator).
  // Never empty the tag entirely.
  if (options.removeFandomDiscriminator) {
    const withoutParens = cleaned.replace(/\s*\([^)]+\)(?=\s*(?:[/&]|$))/g, "");

    if (withoutParens.trim().length > 0) {
      cleaned = withoutParens;
    }
  }

  if (options.removeTagSuffixes) {
    cleaned = cleaned
      .replace(/\s*- Freeform\s*$/, "")
      .replace(/\s*- Fandom\s*$/, "");
  }

  return cleaned.trim();
}

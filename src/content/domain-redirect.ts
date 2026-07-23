import { canonicalAo3Url } from "@src/common/ao3";
import { Logger } from "@src/common/logger";
import { getAllSettings } from "@src/common/settings";

// Runs at document_start on the alternative AO3 domains only (see the
// manifest's match patterns) and moves the tab to archiveofourown.org so
// cookies, logins, and extension data all live on one domain. Not a
// ContentScript subclass: those load with the content root at
// document_idle, far too late for a navigation redirect.

const logger = new Logger("DomainRedirect");

async function redirectToCanonicalDomain(): Promise<void> {
  const target = canonicalAo3Url(window.location.href);

  if (!target) return;

  const settings = await getAllSettings();

  if (!settings.redirectAlternativeDomains) return;

  logger.log(`Redirecting alternative AO3 domain to ${target}`);
  // The replace() call keeps the alternative-domain URL out of tab
  // history so the back button does not bounce through the redirect
  window.location.replace(target);
}

void redirectToCanonicalDomain();

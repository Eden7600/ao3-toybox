# Security Policy

## Supported Versions

Only the latest release of AO3 Toybox is supported with security fixes. Please make sure you're on the [latest release](https://github.com/Eden7600/ao3-toybox/releases/latest) before reporting an issue.

## Reporting a Vulnerability

If you find a security vulnerability in AO3 Toybox, please report it privately rather than opening a public issue:

- Preferred: use [GitHub's private vulnerability reporting](https://github.com/Eden7600/ao3-toybox/security/advisories/new) for this repository.
- Alternatively, email **eden7600@pm.me** with details.

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce it (proof-of-concept code or a minimal repro is very helpful)
- The extension version and browser/version you tested with

You should expect an initial response within a few days. Once a fix is available, a new release will be published and, where appropriate, the report will be credited (unless you'd prefer to stay anonymous).

Please do not disclose the issue publicly until a fix has been released.

## Scope

AO3 Toybox runs entirely client-side: it reads and modifies pages on AO3 domains and stores settings locally in browser storage. It does not run a server and does not transmit data anywhere. Reports most relevant to this project involve things like:

- Content injected onto AO3 pages that could be exploited (e.g. XSS via crafted tag/work content)
- Extension permissions being broader than necessary
- Locally stored data being exposed to sites other than AO3

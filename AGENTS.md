# Voidhash SDKs

This repository holds the Voidhash SDKs (`libraries/*`), the Rust component
SDK (`crates/voidhash-ui`, `crates/voidhash-ui-macros`), the CLI (`apps/cli`)
and example apps that use them (`examples/*`). It has no workspace to install
and no test suites; maintainers build and test contributions after importing
them, as described in `CONTRIBUTING.md`.

- Pull request titles follow Conventional Commits, for example
  `fix: retry a purchase restore after a timeout`.
- Purchase, restore and entitlement behavior must stay correct through
  retries, duplicate events, interrupted connections and app restarts. Check
  failure paths as well as success.
- Keep the SDKs consistent: a behavior change in one usually belongs in the
  others. The React Native SDK reuses the iOS and Android cores rather than
  reimplementing purchase logic.
- Avoid work on an app's launch or purchase path, and watch bundle size.
- Add JSDoc (or the language's equivalent) to public APIs and update the
  package README and examples when an API changes.
